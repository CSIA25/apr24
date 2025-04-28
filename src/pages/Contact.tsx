// src/pages/Contact.tsx
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Mail, User, MessageSquare, Send, Loader2 } from 'lucide-react';
import emailjs from '@emailjs/browser';

const Contact = () => {
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        subject: "",
        message: "",
    });
    const [loading, setLoading] = useState(false);

    // These lines correctly read from the .env file
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!serviceId || !templateId || !publicKey) {
             toast({
                title: "Configuration Error",
                description: "Email sending is not configured correctly. Please check environment variables.",
                variant: "destructive",
            });
            console.error("EmailJS Error: Missing environment variables (VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY)");
            setLoading(false);
            return;
        }

        // Make sure the keys here match your EmailJS template variables (e.g., {{name}}, {{email}})
        const templateParams = {
            name: formData.name,
            email: formData.email,
            subject: formData.subject || '(No Subject)',
            message: formData.message,
        };

        console.log("Sending email with params:", templateParams);

        try {
            // Using send, as it requires explicit parameter mapping which is less error-prone
            // if form names don't match template vars exactly.
            await emailjs.send(serviceId, templateId, templateParams, publicKey);

            console.log("EmailJS SUCCESS!");
            toast({
                title: "Message Sent!",
                description: "Thank you for contacting us. We'll get back to you soon.",
            });
            setFormData({ name: "", email: "", subject: "", message: "" }); // Reset form state
            // formRef.current?.reset(); // Optional: reset the actual form element

        } catch (error: any) {
            console.error('EmailJS FAILED...', error);
            toast({
                title: "Send Failed",
                description: `Could not send your message. Error: ${error?.text || error?.message || 'Unknown error'}`,
                variant: "destructive",
            });
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
            <main className="flex-grow pt-24 pb-16">
                <section className="py-12 md:py-16">
                    <div className="container mx-auto px-4">
                        {/* Header */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="max-w-3xl mx-auto text-center mb-12"
                        >
                            <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
                            <p className="text-lg text-muted-foreground">
                                Have questions or feedback? We'd love to hear from you!
                            </p>
                        </motion.div>

                        {/* Form Card */}
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.5 }}
                            className="max-w-2xl mx-auto"
                        >
                            <Card className="shadow-lg border">
                                <CardHeader>
                                    <CardTitle>Send us a Message</CardTitle>
                                    <CardDescription>Fill out the form below and we'll get back to you as soon as possible.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                                        {/* Name Input */}
                                        <div className="space-y-1">
                                            <Label htmlFor="name">Name *</Label>
                                            <div className="relative">
                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input id="name" name="name" placeholder="Your Name" className="pl-10" required value={formData.name} onChange={handleChange} />
                                            </div>
                                        </div>
                                        {/* Email Input */}
                                         <div className="space-y-1">
                                            <Label htmlFor="email">Email *</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input id="email" name="email" type="email" placeholder="your@email.com" className="pl-10" required value={formData.email} onChange={handleChange} />
                                            </div>
                                        </div>
                                        {/* Subject Input */}
                                        <div className="space-y-1">
                                            <Label htmlFor="subject">Subject</Label>
                                            <Input id="subject" name="subject" placeholder="Regarding..." value={formData.subject} onChange={handleChange} />
                                        </div>
                                         {/* Message Textarea */}
                                        <div className="space-y-1">
                                            <Label htmlFor="message">Message *</Label>
                                            <div className="relative">
                                                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Textarea
                                                    id="message"
                                                    name="message"
                                                    placeholder="Write your message here..."
                                                    className="min-h-[150px] pl-10"
                                                    required
                                                    value={formData.message}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </div>
                                        {/* Submit Button */}
                                        <Button type="submit" className="w-full btn-gradient" disabled={loading}>
                                            {loading ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="mr-2 h-4 w-4" /> Send Message
                                                </>
                                            )}
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </section>
            </main>
            <Footer />
        </motion.div>
    );
};

export default Contact;