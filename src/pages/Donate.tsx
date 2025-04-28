// src/pages/Donate.tsx

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast"; // Corrected path
import { loadStripe } from "@stripe/stripe-js";
import { Heart, Loader2 } from "lucide-react"; // Added Loader2
import { useState } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer"; // Import Footer
import { useAuth } from "@/context/AuthContext"; // Import useAuth
import { motion } from 'framer-motion'; // Import motion

// Ensure your public key is correct
const stripePromise = loadStripe("pk_test_51RA7IB07ioGuItlZN19yfermdJcMDLtRQ68aChMs2XEshctI2sDhYopOgFfoSovBi2eBnTqkWYTLuAsU5Lee4KZV00gJir2o4D");

// Ensure these Price IDs match your Stripe products exactly
const priceIdMap: { [key: string]: string } = {
  "25": "price_1RAuDU07ioGuItlZk7NGaBCp",
  "50": "price_1RAuDp07ioGuItlZIHm0bsyJ",
  "100": "price_1RAuE707ioGuItlZIBeuxrfj",
  "250": "price_1RAuEM07ioGuItlZ8DhnbHxv",
  "500": "price_1RAuEg07ioGuItlZ3IxZIUGY",
};

const DonatePage = () => {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth(); // Get user and auth status
  const [donationType, setDonationType] = useState<"one-time" | "monthly">("one-time");
  const [donationAmount, setDonationAmount] = useState("25");
  const [financialLoading, setFinancialLoading] = useState(false);

  const handleFinancialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (authLoading) return; // Don't proceed if auth state is still loading

    if (!user) { // Check if user is logged in
       toast({ title: "Login Required", description: "Please log in to make a donation.", variant: "destructive" });
       return; // Stop the process if not logged in
    }

    setFinancialLoading(true);

    const stripe = await stripePromise;

    if (!stripe) {
      toast({ title: "Error", description: "Stripe failed to load.", variant: "destructive" });
      setFinancialLoading(false);
      return;
    }

    const priceId = priceIdMap[donationAmount];

    if (!priceId) {
      toast({
        title: "Invalid Amount",
        description: "The selected donation amount is invalid.",
        variant: "destructive",
      });
      setFinancialLoading(false);
      return;
    }

    try {
      // Construct success URL with amount and session placeholder
      const successUrl = `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}&amount=${donationAmount}`;
      console.log("Redirecting to Stripe Checkout with:", {
        priceId,
        mode: donationType === "monthly" ? "subscription" : "payment",
        userId: user.uid, // Log the user ID being sent
        successUrl,
      });

      const { error } = await stripe.redirectToCheckout({
        lineItems: [{ price: priceId, quantity: 1 }],
        mode: donationType === "monthly" ? "subscription" : "payment",
        successUrl: successUrl,
        cancelUrl: `${window.location.origin}/donate`,
        clientReferenceId: user.uid // Pass Firebase User ID
      });

      if (error) throw error; // If error, it will be caught below

    } catch (err: any) {
      toast({
        title: "Stripe Error",
        description: err.message || "An error occurred during checkout.",
        variant: "destructive",
      });
      console.error("Stripe Checkout Error:", err);
      setFinancialLoading(false); // Ensure loading is stopped on error
    }
    // No finally block needed here as redirect happens on success
  };

  return (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen flex flex-col bg-background"
    >
      <Navbar />
      <main className="flex-grow flex items-center justify-center pt-20 pb-16 px-4">
        <Card className="w-full max-w-2xl shadow-2xl rounded-2xl border border-border">
          <CardContent className="p-6 md:p-8">
            <form onSubmit={handleFinancialSubmit}>
              <h2 className="text-3xl font-bold text-center mb-6 flex items-center justify-center gap-2">
                <Heart className="text-pink-500 w-8 h-8" />
                Support Our Mission
              </h2>
              <p className="text-center text-muted-foreground mb-8">
                Your generous donation helps us keep our platform running and support important causes.
              </p>

              <Tabs defaultValue="one-time" onValueChange={(val) => setDonationType(val as "one-time" | "monthly")} className="w-full">
                <TabsList className="grid grid-cols-2 mb-6">
                  <TabsTrigger value="one-time">One-Time</TabsTrigger>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                </TabsList>

                <TabsContent value="one-time">
                  <DonationAmountSelector
                    selectedAmount={donationAmount}
                    onAmountChange={setDonationAmount}
                  />
                </TabsContent>

                <TabsContent value="monthly">
                  <DonationAmountSelector
                    selectedAmount={donationAmount}
                    onAmountChange={setDonationAmount}
                  />
                </TabsContent>
              </Tabs>

              <Button
                type="submit"
                className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors mt-6"
                disabled={financialLoading || authLoading} // Disable if auth is loading too
              >
                {authLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {financialLoading ? "Processing..." : "Donate"}
              </Button>
              {!user && !authLoading && <p className="text-center text-destructive text-sm mt-2">Please log in to donate.</p>}
            </form>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </motion.div>
  );
};

// DonationAmountSelector component remains the same
const DonationAmountSelector = ({
  selectedAmount,
  onAmountChange,
}: {
  selectedAmount: string;
  onAmountChange: (amount: string) => void;
}) => {
  const predefinedAmounts = ["25", "50", "100", "250", "500"];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {predefinedAmounts.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onAmountChange(amount)}
          className={`py-3 px-4 rounded-xl border font-medium text-lg transition-colors ${
            selectedAmount === amount
              ? "bg-pink-600 text-white border-transparent ring-2 ring-pink-300 ring-offset-1" // Added ring for better visibility
              : "bg-white text-gray-800 border-gray-300 hover:bg-pink-50"
          }`}
        >
          ${amount}
        </button>
      ))}
    </div>
  );
};


export default DonatePage;