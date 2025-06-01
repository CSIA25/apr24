// src/pages/Success.tsx
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { CheckCircle, Loader2, AlertCircle, Home } from "lucide-react"; // Added Home icon
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { getFirestore, doc, updateDoc, increment, FieldValue } from "firebase/firestore"; // Added FieldValue
import { app } from "@/firebase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast"; // Corrected path

const db = getFirestore(app);

const Success = () => {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  // Confetti effect
  useEffect(() => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      confetti({
        ...defaults,
        particleCount: 5, // Reduced particle count slightly
        origin: {
          x: Math.random(),
          y: Math.random() - 0.2,
        },
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  // Update Firestore effect
  useEffect(() => {
    let isMounted = true; // Prevent state updates on unmounted component

    const updateDonationCount = async () => {
      if (authLoading || !user || updateStatus !== 'idle' || !isMounted) {
          // If auth is still loading or user isn't available yet, wait.
          // If status is not 'idle', it means we already processed or are processing.
          // If component is unmounted, stop.
          return;
      }

      setUpdateStatus('pending'); // Set status immediately
      setErrorMessage(null);

      const sessionId = searchParams.get("session_id");
      const amountStr = searchParams.get("amount");

      if (!sessionId) {
        console.warn("Success page loaded without session_id");
        if (isMounted) {
             setUpdateStatus('error');
             setErrorMessage("Missing payment session info. Leaderboard update skipped.");
        }
        return;
      }
       if (!amountStr || isNaN(Number(amountStr))) {
          console.warn("Success page loaded without valid amount");
          if (isMounted) {
              setUpdateStatus('error');
              setErrorMessage("Missing amount info. Leaderboard update skipped.");
          }
          return;
      }

      const amount = Number(amountStr);
      if (amount <= 0) {
          console.warn("Invalid amount received:", amount);
           if (isMounted) {
              setUpdateStatus('error');
              setErrorMessage("Invalid donation amount received.");
          }
          return;
      }


      try {
        console.log(`Updating totalDonated for user ${user.uid} by ${amount}`);
        const userRef = doc(db, "users", user.uid);

        // --- IMPORTANT: Firestore Security Rules NEEDED ---
        // You MUST have Firestore rules to protect this update.
        // A basic rule would be:
        // match /users/{userId} {
        //   allow read: if true; // Or adjust as needed
        //   allow update: if request.auth.uid == userId &&
        //                    request.resource.data.totalDonated == resource.data.totalDonated + <amount>; // Verifying exact amount is tricky client-side
        //                    // Simpler (less secure but functional for this approach):
        //                    request.resource.data.totalDonated > resource.data.totalDonated; // Ensure it only increases
        // }
        // The increment operation itself provides some atomicity.

        await updateDoc(userRef, {
          totalDonated: increment(amount) // Use Firestore increment
        });

        console.log("Firestore update successful");
         if (isMounted) {
            setUpdateStatus('success');
            toast({title: "Leaderboard Updated", description: "Your contribution is reflected!"});
        }

      } catch (error: any) {
        console.error("Failed to update donation count:", error);
        if (isMounted) {
            setUpdateStatus('error');
            setErrorMessage("Failed to update leaderboard status."); // Keep it simple for the user
            toast({title: "Leaderboard Update Failed", description: "Could not update your donation status on the leaderboard.", variant: "destructive"});
        }
      }
    };

    updateDonationCount();

    return () => { isMounted = false }; // Cleanup function

  }, [user, authLoading, searchParams, updateStatus, db, toast]); // Dependencies

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <CheckCircle className="text-green-500 w-24 h-24" />
      </motion.div>

      <motion.h1
        className="mt-6 text-3xl font-bold text-center text-gray-800"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Donation Successful!
      </motion.h1>

      <motion.p
        className="mt-2 text-center text-gray-600"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        Thank you for your contribution 💖
      </motion.p>

      {/* Update Status Display */}
      <motion.div
         className="mt-4 text-sm text-center h-6" // Reserve space
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         transition={{ delay: 0.6 }}>
          {updateStatus === 'pending' && (
              <span className="flex items-center justify-center text-muted-foreground"><Loader2 className="h-4 w-4 mr-1 animate-spin"/> Updating leaderboard...</span>
          )}
          {updateStatus === 'error' && (
              <span className="flex items-center justify-center text-destructive"><AlertCircle className="h-4 w-4 mr-1"/> {errorMessage || 'Leaderboard update failed.'}</span>
          )}
           {updateStatus === 'success' && (
              <span className="flex items-center justify-center text-green-600"><CheckCircle className="h-4 w-4 mr-1"/> Leaderboard updated!</span>
          )}
          {/* Show nothing if 'idle' */}
      </motion.div>

      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
         <Button asChild size="lg">
             <Link
                to="/"
                className="px-6 py-2 bg-green-500 text-white rounded-full font-medium hover:bg-green-600 transition-colors flex items-center" // Added flex
            >
                <Home className="mr-2 h-5 w-5" /> {/* Added Home icon */}
                Go Back to Home
            </Link>
         </Button>
      </motion.div>
    </div>
  );
};

export default Success;