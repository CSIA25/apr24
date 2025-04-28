// src/components/dashboard/NgoIssuesView.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { getFirestore, collection, query, where, getDocs, orderBy, doc, updateDoc, Timestamp, limit, getDoc, serverTimestamp } from "firebase/firestore"; // Added serverTimestamp
import { app } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Loader2, AlertCircle, CheckSquare, PlayCircle, ExternalLink, Link as LinkIcon, CalendarDays, MapPin } from 'lucide-react'; // Added icons
import { useToast } from '@/hooks/use-toast'; // Use correct hook path
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Keep Alert Dialog

interface Issue {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    imageUrl?: string;
    reporterId: string;
    timestamp: Timestamp;
    status: 'pending' | 'in-progress' | 'resolved';
    latitude?: number | null; // Add these if saved during report
    longitude?: number | null;
    updatedAt?: Timestamp; // Added
}

interface NgoProfileData {
    focusAreas?: string[];
    orgName?: string;
}

interface NgoIssuesViewProps {
    ngoId: string;
}

// Helper function to format date/time
const formatDate = (dateInput: Timestamp | undefined | null, includeTime = true): string => {
    if (!dateInput) return "N/A";
    try {
        const date = dateInput.toDate();
        if (isNaN(date.getTime())) return "Invalid Date";
        return format(date, includeTime ? "PPp" : "PP");
    } catch (e) {
        console.error("Error formatting date:", dateInput, e);
        return "Error";
    }
};

const NgoIssuesView: React.FC<NgoIssuesViewProps> = ({ ngoId }) => {
    const { toast } = useToast();
    const [issues, setIssues] = useState<Issue[]>([]);
    const [ngoProfile, setNgoProfile] = useState<NgoProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updatingIssueId, setUpdatingIssueId] = useState<string | null>(null); // Track which issue is being updated

    const db = getFirestore(app); // Initialize Firestore

    // Fetch NGO profile and relevant issues
    useEffect(() => {
        let isMounted = true; // Prevent state update on unmounted component

        const fetchData = async () => {
            if (!isMounted || !ngoId) return; // Exit if component unmounted or no ngoId

            setLoading(true);
            setError(null);
            let fetchedFocusAreas: string[] = [];

            try {
                // 1. Fetch NGO Profile
                console.log("[NgoIssuesView] Fetching profile for NGO ID:", ngoId);
                const ngoProfileRef = doc(db, "ngo_profiles", ngoId);
                const profileSnap = await getDoc(ngoProfileRef);

                if (profileSnap.exists() && isMounted) {
                    const profileData = profileSnap.data() as NgoProfileData;
                    setNgoProfile(profileData);
                    fetchedFocusAreas = profileData.focusAreas || [];
                    console.log("[NgoIssuesView] NGO Profile Data:", profileData);
                } else if (isMounted) {
                    console.error("[NgoIssuesView] NGO profile NOT FOUND for ID:", ngoId);
                    setError("Your NGO profile could not be found. Cannot load relevant issues.");
                    setLoading(false);
                    return; // Stop if profile not found
                }

                // 2. Fetch Relevant Issues based on Focus Areas
                if (fetchedFocusAreas.length === 0) {
                    console.log("[NgoIssuesView] No focus areas defined. No issues will be fetched.");
                    if (isMounted) {
                        setIssues([]); // Clear issues if no focus areas
                        setLoading(false);
                    }
                    return; // Stop if no focus areas
                }

                let areasToQuery = fetchedFocusAreas;
                // Firestore 'in' query limit is 30
                if (areasToQuery.length > 30) {
                    console.warn("[NgoIssuesView] More than 30 focus areas. Querying first 30.");
                    areasToQuery = areasToQuery.slice(0, 30);
                }

                const targetStatuses: Issue['status'][] = ["pending", "in-progress"]; // Show only actionable issues

                console.log("[NgoIssuesView] Querying issues with categories:", areasToQuery, "and statuses:", targetStatuses);

                const q = query(
                    collection(db, "issues"),
                    where("category", "in", areasToQuery),
                    where("status", "in", targetStatuses),
                    orderBy("timestamp", "desc"), // Show newest first
                    limit(50) // Limit results for performance
                );

                const querySnapshot = await getDocs(q);
                if (!isMounted) return; // Check again before setting state

                const fetchedIssues: Issue[] = [];
                querySnapshot.forEach((doc) => {
                     const data = doc.data();
                    // Basic validation for required fields
                     if (data.title && data.category && data.location && data.reporterId && data.timestamp instanceof Timestamp && data.status) {
                         fetchedIssues.push({ id: doc.id, ...data } as Issue);
                     } else {
                         console.warn("Skipping issue doc with missing/invalid fields:", doc.id, data);
                     }
                });
                setIssues(fetchedIssues);
                console.log(`[NgoIssuesView] Query completed. Found ${fetchedIssues.length} matching issues.`);

            } catch (err: any) {
                console.error("[NgoIssuesView] Firestore Query Error:", err);
                if (isMounted) {
                     if (err.code === 'failed-precondition' && err.message.includes('index')) {
                        setError("Database index needed. Please check Firestore console for index suggestions on the 'issues' collection.");
                     } else {
                        setError("Failed to load relevant issues. " + err.message);
                     }
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => { isMounted = false; }; // Cleanup function

    }, [ngoId, db]); // Depend on ngoId and db instance

    // Function to handle status updates
    const handleUpdateStatus = useCallback(async (issueId: string, newStatus: 'in-progress' | 'resolved') => {
        if (!ngoId) return; // Should have ngoId if this component renders
        setUpdatingIssueId(issueId); // Indicate loading for this specific issue

        const issueRef = doc(db, "issues", issueId);

        try {
            console.log(`Updating issue ${issueId} to status ${newStatus} by NGO ${ngoId}`);
            await updateDoc(issueRef, {
                status: newStatus,
                updatedAt: serverTimestamp() // Track when it was last updated
                // Optionally add: assignedNgoId: ngoId, assignedNgoName: ngoProfile?.orgName || 'NGO'
            });

            // Update local state for immediate UI feedback
            setIssues(prevIssues =>
                prevIssues
                    .map(issue => issue.id === issueId ? { ...issue, status: newStatus } : issue)
                    // Optionally remove 'resolved' issues immediately from the view
                    // .filter(issue => newStatus === 'in-progress' || issue.id !== issueId)
            );

            toast({
                title: "Status Updated",
                description: `Issue marked as ${newStatus.replace('-', ' ')}.`,
            });

        } catch (error: any) {
            console.error(`Error updating issue ${issueId} status:`, error);
            toast({
                title: "Update Failed",
                description: `Could not update issue status: ${error.message}`,
                variant: "destructive",
            });
        } finally {
            setUpdatingIssueId(null); // Stop loading indicator for this issue
        }
    }, [db, ngoId, toast]); // Include dependencies

    // Helper to get location display string or Map link
    const getLocationDisplay = (issue: Issue): React.ReactNode => {
        if (issue.location.startsWith('coords:')) {
            const parts = issue.location.substring(7).split(',');
            if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                    return (
                        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center text-xs sm:text-sm">
                           <MapPin className="h-4 w-4 mr-1"/> View on Map <ExternalLink className="h-3 w-3 ml-1"/>
                        </a>
                    );
                }
            }
        }
        // Fallback to showing the raw string if not coords or parsing fails
        return <span className="inline-flex items-center"><MapPin className="h-4 w-4 mr-1"/>{issue.location}</span>;
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Relevant Community Issues</CardTitle>
                <CardDescription>
                    {ngoProfile?.focusAreas && ngoProfile.focusAreas.length > 0
                        ? `Showing issues matching your focus areas: ${ngoProfile.focusAreas.join(', ')}`
                        : "No focus areas set in your profile to filter issues."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {loading && ( <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> )}
                {error && ( <div className="text-destructive bg-destructive/10 p-4 rounded-md text-sm">{error}</div> )}
                {!loading && !error && issues.length === 0 && (
                    <p className="text-muted-foreground text-center py-6 text-sm">
                        No actionable issues found matching your focus areas right now.
                    </p>
                )}
                {!loading && !error && issues.length > 0 && (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 border-t pt-4">
                        {issues.map((issue) => (
                            <Card key={issue.id} className="bg-background/50 border">
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                     <div className="space-y-1">
                                        <CardTitle className="text-base">{issue.title}</CardTitle>
                                        <CardDescription className="text-xs pt-0.5">Category: {issue.category}</CardDescription>
                                     </div>
                                     <Badge
                                        variant={issue.status === 'pending' ? 'purple' : 'teal'}
                                        className="capitalize text-xs flex-shrink-0 ml-2"
                                    >
                                        {issue.status.replace('-', ' ')}
                                    </Badge>
                                </CardHeader>
                                <CardContent className="text-sm space-y-2">
                                    <p className="text-muted-foreground line-clamp-3">{issue.description}</p>
                                    <div className="text-xs text-muted-foreground">{getLocationDisplay(issue)}</div>
                                    <div className="flex items-center text-xs text-muted-foreground">
                                        <CalendarDays className="h-3.5 w-3.5 mr-1"/> Reported: {formatDate(issue.timestamp)}
                                     </div>
                                    {issue.imageUrl && (
                                        <a href={issue.imageUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs inline-flex items-center mt-1">
                                            <LinkIcon className="h-3.5 w-3.5 mr-1"/> View Attached Image
                                        </a>
                                    )}
                                </CardContent>
                                <CardFooter className="pt-3 border-t flex justify-end gap-2">
                                    {issue.status === 'pending' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleUpdateStatus(issue.id, 'in-progress')}
                                            disabled={updatingIssueId === issue.id}
                                            className="text-blue-700 border-blue-200 hover:bg-blue-50"
                                        >
                                            {updatingIssueId === issue.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <PlayCircle className="h-4 w-4 mr-1"/>} Start Progress
                                        </Button>
                                    )}
                                    {(issue.status === 'pending' || issue.status === 'in-progress') && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="default" size="sm" disabled={updatingIssueId === issue.id} className="bg-green-600 hover:bg-green-700">
                                                    {updatingIssueId === issue.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckSquare className="h-4 w-4 mr-1"/>} Mark Resolved
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Confirm Resolution</AlertDialogTitle>
                                                    <AlertDialogDescription>Are you sure you want to mark this issue as resolved?</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel disabled={updatingIssueId === issue.id}>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleUpdateStatus(issue.id, 'resolved')} disabled={updatingIssueId === issue.id} className={buttonVariants({variant: "default", className:"bg-green-600 hover:bg-green-700"})}>
                                                        Confirm Resolved
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default NgoIssuesView;