// src/pages/ForgotPassword.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, Loader2, ArrowLeft } from 'lucide-react';
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { app } from "../firebase"; // Adjust path if needed

const auth = getAuth(app);

const ForgotPasswordPage = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setEmailSent(false); // Reset on new attempt

        if (!email) {
            toast({
                title: "Email Required",
                description: "Please enter your email address.",
                variant: "destructive",
            });
            setLoading(false);
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            toast({
                title: "Password Reset Email Sent",
                description: "If an account exists for this email, a reset link has been sent. Please check your inbox (and spam folder).",
                duration: 7000, 
            });
            setEmailSent(true);
            setEmail(""); // Clear the input field
        } catch (error: any) {
            console.error("Forgot Password Error:", error);
            // Firebase typically doesn't reveal if an email exists for security.
            // For common errors like invalid email format, Firebase Auth SDK itself might throw.
            if (error.code === 'auth/invalid-email') {
                toast({
                    title: "Invalid Email",
                    description: "Please enter a valid email address.",
                    variant: "destructive",
                });
            } else if (error.code === 'auth/user-not-found') {
                 // Still show generic success to prevent email enumeration, but log it.
                 console.warn("User not found for password reset attempt, but generic success message shown to user.");
                 toast({
                    title: "Password Reset Email Sent",
                    description: "If an account exists for this email, a reset link has been sent. Please check your inbox (and spam folder).",
                    duration: 7000,
                });
                setEmailSent(true);
                setEmail("");
            }
            else {
                toast({
                    title: "Error Sending Email",
                    description: "An unexpected error occurred. Please try again later.",
                    variant: "destructive",
                });
            }
        } finally {
            setLoading(false);
        }
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
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="w-full max-w-md"
                >
                    <Card className="shadow-xl border">
                        <CardHeader>
                            <CardTitle className="text-2xl font-bold text-center">Forgot Your Password?</CardTitle>
                            <CardDescription className="text-center text-muted-foreground">
                                No worries! Enter your email address below and we'll send you a link to reset it.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!emailSent ? (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="space-y-1">
                                        <Label htmlFor="email">Email Address</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="email"
                                                type="email"
                                                name="email"
                                                placeholder="your@email.com"
                                                className="pl-10"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                disabled={loading}
                                            />
                                        </div>
                                    </div>
                                    <Button type="submit" className="w-full btn-gradient" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                                            </>
                                        ) : (
                                            "Send Reset Link"
                                        )}
                                    </Button>
                                </form>
                            ) : (
                                <div className="text-center space-y-4 py-4">
                                    <p className="text-green-600">
                                        If an account with that email exists, a password reset link has been sent. Please check your inbox (and spam folder).
                                    </p>
                                    <Button variant="outline" onClick={() => { setEmailSent(false); setEmail(""); }}>
                                        Send to a Different Email?
                                    </Button>
                                </div>
                            )}
                            <div className="mt-6 text-center">
                                <Link
                                    to="/login"
                                    className="text-sm text-primary hover:underline inline-flex items-center"
                                >
                                    <ArrowLeft className="mr-1 h-4 w-4" /> Back to Login
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </main>
            <Footer />
        </motion.div>
    );
};

export default ForgotPasswordPage;