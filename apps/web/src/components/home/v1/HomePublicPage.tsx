import { Header } from "@/components/layout/Header";
import { HomeOneExplore } from "@/components/home/v1/HomeOneExplore";
import { HomeOneAudience, HomeOneFlow } from "@/components/home/v1/HomeOneFlow";
import { HomeOneHero, HomeOneManifesto } from "@/components/home/v1/HomeOneHero";
import { HomeOneReveal } from "@/components/home/v1/HomeOneMotion";
import { HomeOneFooter, HomeOnePlans } from "@/components/home/v1/HomeOnePlans";

export function HomePublicPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f7f6] text-[#0f1f1d]">
      <div className="relative bg-[#0e1614]">
        <Header tone="ink" variant="home1" />
        <HomeOneHero />
      </div>

      <HomeOneReveal>
        <HomeOneManifesto />
      </HomeOneReveal>
      <HomeOneReveal delay={60}>
        <HomeOneExplore />
      </HomeOneReveal>
      <HomeOneReveal delay={80}>
        <HomeOneFlow />
      </HomeOneReveal>
      <HomeOneReveal delay={100}>
        <HomeOneAudience />
      </HomeOneReveal>
      <HomeOneReveal delay={120}>
        <HomeOnePlans />
      </HomeOneReveal>
      <HomeOneFooter />
    </main>
  );
}
