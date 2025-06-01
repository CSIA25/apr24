// src/pages/Index.tsx
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "@/components/sections/hero-section";
import { IssuesSection } from "@/components/sections/issues-section";
// REMOVE THE NEXT LINE:
// import { OrganizationsSection } from "@/components/sections/organizations-section";
import { ImpactSection } from "@/components/sections/impact-section";
import { CallToAction } from "@/components/sections/call-to-action";
// REMOVE THE NEXT LINE:
// import { DonationLeaderboardSection } from "@/components/sections/leaderboard-section";


const Home = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex flex-col"
    >
      <Navbar />
      <main className="flex-grow">
        <HeroSection />
        <IssuesSection />
        {/* REMOVE THE NEXT LINE: */}
        {/* <OrganizationsSection /> */}
        {/* --- Keep Leaderboard Section Usage --- */}
        {/* <DonationLeaderboardSection /> */} {/* Keep this if you want it */}
        <ImpactSection />
        <CallToAction />
      </main>
      <Footer />
    </motion.div>
  );
};

export default Home;