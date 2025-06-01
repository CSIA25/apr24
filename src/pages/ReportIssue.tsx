// src/pages/ReportIssue.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MapPin, Upload, AlertCircle, LocateFixed, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAuth } from "firebase/auth";
import { getFirestore, addDoc, collection, serverTimestamp } from "firebase/firestore"; // Removed Timestamp import as it's handled by serverTimestamp
import { app } from "../firebase";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

// Geoapify API Key from environment variables
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

// Define types for Geoapify responses (simplified)
interface GeoapifyFeatureProperties {
    address_line1?: string;
    address_line2?: string;
    formatted: string;
    lat: number;
    lon: number;
    place_id: string;
    // Add other properties you might need from Geoapify
}
interface GeoapifyFeature {
    properties: GeoapifyFeatureProperties;
}
interface GeoapifyAutocompleteResponse {
    features: GeoapifyFeature[];
}
interface GeoapifyReverseResponse {
    features: GeoapifyFeature[];
}

interface LatLng { lat: number | null; lng: number | null; }

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => resolve(func(...args)), waitFor);
    });
}

const ReportIssue = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false); // Main form loading
    const [loadingLocation, setLoadingLocation] = useState(false); // Geolocation button loading
    const [loadingSuggestions, setLoadingSuggestions] = useState(false); // Autocomplete loading
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        category: "",
        image: null as string | null, // Store filename or null
    });
    const [locationInput, setLocationInput] = useState(""); // User's typed input/selected address
    const [suggestions, setSuggestions] = useState<GeoapifyFeature[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedCoords, setSelectedCoords] = useState<LatLng | null>(null); // Stored coords {lat, lng}
    const [file, setFile] = useState<File | null>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null); // Ref for suggestions dropdown

    // Check API Key on mount
    useEffect(() => {
         if (!GEOAPIFY_API_KEY) {
            console.error("Geoapify API Key (VITE_GEOAPIFY_API_KEY) is missing!");
            toast({ title: "Configuration Error", description: "Location services are unavailable. Please ensure VITE_GEOAPIFY_API_KEY is set.", variant: "destructive"});
         }
    }, [toast]); // Add toast as dependency

    // --- Image Upload Logic ---
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            const file = acceptedFiles[0];
            // Basic File Validation (Example)
            const maxSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
            if (!allowedTypes.includes(file.type)) {
                toast({ title: "Invalid File Type", description: "Please upload an image (JPEG, PNG, GIF, WebP).", variant: "destructive"});
                return;
            }
            if (file.size > maxSize) {
                 toast({ title: "File Too Large", description: "Please upload an image smaller than 10MB.", variant: "destructive"});
                 return;
            }
            setFile(file);
            setFormData((prev) => ({ ...prev, image: file.name })); // Store filename
        }
    }, [toast]); // Add toast as dependency

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "image/*": [] }, // Use MIME types for better compatibility
        maxFiles: 1
    });

    const uploadToImgBB = async (fileToUpload: File): Promise<string> => {
        const uploadFormData = new FormData();
        uploadFormData.append("file", fileToUpload);
        uploadFormData.append("upload_preset", "merosamaj"); // Ensure this preset exists in Cloudinary

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/doracgsym/image/upload`, // Ensure cloud name is correct
            { method: "POST", body: uploadFormData }
        );
        const data = await response.json();
        if (!data.secure_url) {
            throw new Error(`Image upload failed: ${data.error?.message || 'Unknown Cloudinary error'}`);
        }
        return data.secure_url;
    };
    // --- End Image Upload Logic ---

    // --- Form Handlers ---
    const handleBaseChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (value: string) => {
        setFormData((prev) => ({ ...prev, category: value }));
    };
    // --- End Form Handlers ---

    // --- Location Autocomplete ---
    const fetchSuggestions = useCallback(async (text: string) => {
        if (!text || text.length < 3 || !GEOAPIFY_API_KEY) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        setLoadingSuggestions(true);
        try {
            // You can add more parameters like 'bias=proximity:auto' or 'filter=countrycode:np'
            const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&limit=5&apiKey=${GEOAPIFY_API_KEY}`);
            if (!response.ok) throw new Error(`Geoapify request failed: ${response.statusText}`);
            const data: GeoapifyAutocompleteResponse = await response.json();
            setSuggestions(data.features || []);
            setShowSuggestions(data.features && data.features.length > 0); // Only show if there are suggestions
        } catch (error: any) {
            console.error("Error fetching Geoapify suggestions:", error);
            setSuggestions([]);
            setShowSuggestions(false);
            // Consider showing a subtle error or just failing silently
            // toast({ title: "Location Suggestion Error", description: error.message, variant: "destructive" });
        } finally {
            setLoadingSuggestions(false);
        }
    }, [GEOAPIFY_API_KEY]); // Add API Key dependency

    // Use useRef to ensure debounce function is not recreated on every render
    const debouncedFetchRef = useRef(debounce(fetchSuggestions, 400));

    const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setLocationInput(value);
        setSelectedCoords(null); // Clear coords when typing manually
        debouncedFetchRef.current(value); // Call the debounced function
    };

    const handleSuggestionClick = (suggestion: GeoapifyFeature) => {
        const { formatted, lat, lon } = suggestion.properties;
        setLocationInput(formatted);
        setSelectedCoords({ lat: lat, lng: lon });
        setSuggestions([]);
        setShowSuggestions(false);
    };

    // Hide suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);
    // --- End Location Autocomplete ---

     // --- Geolocation Handler ---
    const handleGetCurrentGeoLocation = () => {
        if (!navigator.geolocation) {
            toast({ title: "Geolocation Not Supported", description: "Your browser doesn't support geolocation.", variant: "destructive" });
            return;
        }

        setLoadingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                const coords: LatLng = { lat: latitude, lng: longitude };
                setSelectedCoords(coords);

                if (!GEOAPIFY_API_KEY) {
                     setLocationInput(`Coords: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                     toast({ title: "Location Found", description: "Coordinates set (Address lookup unavailable).", variant:"default"});
                     setLoadingLocation(false);
                     return;
                }

                try {
                     const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${GEOAPIFY_API_KEY}`);
                     if (!response.ok) throw new Error(`Reverse geocoding failed: ${response.statusText}`);
                     const data: GeoapifyReverseResponse = await response.json();

                     if (data.features && data.features.length > 0) {
                         const address = data.features[0].properties.formatted;
                         setLocationInput(address);
                         toast({ title: "Location Set", description: address });
                     } else {
                         setLocationInput(`Coords: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                         toast({ title: "Location Found", description: "Coordinates set, no address found." });
                     }
                } catch(error: any){
                     console.error("Reverse geocoding error:", error);
                     setLocationInput(`Coords: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                     toast({ title: "Location Found", description: `Coordinates set. ${error.message}`, variant:"default"});
                } finally {
                    setLoadingLocation(false);
                }
            },
            (error) => {
                toast({ title: "Location Error", description: `Error getting location: ${error.message}`, variant: "destructive" });
                setLoadingLocation(false);
            },
            { enableHighAccuracy: true }
        );
    };
    // --- End Geolocation Handler ---

    // --- Form Submission ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const auth = getAuth();
        const user = auth.currentUser;
        const db = getFirestore(app);

        if (!user) {
            toast({ title: "Not Authenticated", description: "Please log in.", variant: "destructive" });
            setLoading(false);
            return;
        }

        const finalLocationString = locationInput.trim();

        if (!formData.title || !formData.description || !formData.category || !finalLocationString) {
             toast({ title: "Missing Fields", description: "Please fill Title, Category, Description, and Location.", variant: "destructive" });
             setLoading(false);
             return;
        }

        try {
            let uploadedImageUrl: string | null = null;
            if (file) {
                uploadedImageUrl = await uploadToImgBB(file);
            }

            const issueData = {
                title: formData.title,
                description: formData.description,
                category: formData.category,
                location: finalLocationString, // Save the address string
                latitude: selectedCoords?.lat ?? null,
                longitude: selectedCoords?.lng ?? null,
                imageUrl: uploadedImageUrl,
                reporterId: user.uid,
                reporterName: user.displayName || user.email || 'Anonymous',
                timestamp: serverTimestamp(),
                status: 'pending',
            };

            console.log("Adding issue to Firestore:", issueData);
            const docRef = await addDoc(collection(db, "issues"), issueData);
            console.log("Issue added with ID:", docRef.id);

            toast({ title: "Issue Reported", description: "Report submitted successfully!" });
            // Reset form state completely
            setFormData({ title: "", description: "", category: "", image: null });
            setFile(null);
            setLocationInput("");
            setSelectedCoords(null);
            setShowSuggestions(false);

        } catch (error: any) {
            console.error("Error submitting report:", error);
            toast({ title: "Report Failed", description: error.message || "An error occurred.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    // --- End Form Submission ---


    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col"
        >
            <Navbar />
            <main className="flex-grow pt-20">
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4">
                        {/* Header */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="max-w-3xl mx-auto text-center mb-12"
                        >
                            <h1 className="text-4xl md:text-5xl font-bold mb-4">Report an Issue</h1>
                            <p className="text-muted-foreground">
                                Help us improve the community. Report issues with details and location.
                            </p>
                        </motion.div>

                        {/* Form Card */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="max-w-2xl mx-auto bg-background rounded-xl shadow-lg p-6 md:p-8 border"
                        >
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Issue Title */}
                                <div className="space-y-2">
                                    <Label htmlFor="title">Issue Title *</Label>
                                    <Input id="title" name="title" placeholder="E.g., Pothole on Main Street" value={formData.title} onChange={handleBaseChange} required />
                                </div>

                                {/* Category */}
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category *</Label>
                                    <Select value={formData.category} onValueChange={handleSelectChange} required>
                                        <SelectTrigger><SelectValue placeholder="Select issue category" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="infrastructure">Infrastructure (Roads, Lights)</SelectItem>
                                            <SelectItem value="environment">Environment (Waste, Pollution)</SelectItem>
                                            <SelectItem value="safety">Safety & Security</SelectItem>
                                            <SelectItem value="health">Public Health</SelectItem>
                                            <SelectItem value="social">Social Welfare</SelectItem>
                                            <SelectItem value="animal welfare">Animal Welfare</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Description */}
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description *</Label>
                                    <Textarea id="description" name="description" placeholder="Describe the issue clearly..." value={formData.description} onChange={handleBaseChange} className="min-h-[120px]" required />
                                </div>

                                {/* --- Geoapify Location Section --- */}
                                <div className="space-y-2">
                                    <Label htmlFor="location-search">Location *</Label>
                                    {!GEOAPIFY_API_KEY && (
                                        <div className="flex items-center text-destructive bg-destructive/10 text-sm p-2 border border-destructive/50 rounded-md">
                                           <AlertCircle className="h-4 w-4 mr-2" /> Location search unavailable (API Key missing).
                                       </div>
                                    )}
                                    <div className="relative" ref={suggestionsRef}>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                                            <Input
                                                id="location-search"
                                                placeholder="Search address or place..."
                                                value={locationInput}
                                                onChange={handleLocationInputChange}
                                                onFocus={() => setShowSuggestions(true)}
                                                className="pl-10 pr-10" // Add padding-right for loader
                                                required
                                                autoComplete="off"
                                                disabled={!GEOAPIFY_API_KEY}
                                            />
                                            {loadingSuggestions && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                                        </div>
                                        {/* Suggestions Dropdown */}
                                        {showSuggestions && suggestions.length > 0 && (
                                            <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {suggestions.map((suggestion) => (
                                                    <div
                                                        key={suggestion.properties.place_id}
                                                        className="p-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                                        onClick={() => handleSuggestionClick(suggestion)}
                                                        onMouseDown={(e) => e.preventDefault()} // Prevent input blur on click
                                                    >
                                                        {suggestion.properties.formatted}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* Geolocation Button */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full mt-2"
                                        onClick={handleGetCurrentGeoLocation}
                                        disabled={loadingLocation || !GEOAPIFY_API_KEY}
                                    >
                                        {loadingLocation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
                                         Use My Current Location
                                    </Button>
                                     {/* Display selected coordinates for feedback */}
                                    {selectedCoords && (
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                            <MapPin className="h-3 w-3"/> Selected Coords: {selectedCoords.lat?.toFixed(5)}, {selectedCoords.lng?.toFixed(5)}
                                        </p>
                                    )}
                                </div>
                                {/* --- End Geoapify Location Section --- */}


                                {/* Image Upload */}
                                <div className="space-y-2">
                                    <Label htmlFor="image-upload">Upload Image (Optional)</Label>
                                    <div {...getRootProps()} id="image-upload" className={cn("border-2 border-dashed border-muted-foreground/20 rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors", isDragActive && "ring-2 ring-primary ring-offset-1")}>
                                        <input {...getInputProps()} />
                                        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                                        <p className="text-sm text-muted-foreground">{isDragActive ? "Drop image here..." : "Drag 'n' drop or click to select"}</p>
                                    </div>
                                    {file && <p className="text-sm mt-2">Selected: {file.name}</p>}
                                </div>

                                {/* Info Box */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                                    <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                                    <p className="text-sm text-blue-700">Accurate details help us address the issue effectively.</p>
                                </div>

                                {/* Submit Button */}
                                <Button type="submit" className="w-full" variant="gradient" disabled={loading || !GEOAPIFY_API_KEY}>
                                    {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Report"}
                                </Button>
                            </form>
                        </motion.div>
                    </div>
                </section>
            </main>
            <Footer />
        </motion.div>
    );
};

export default ReportIssue;