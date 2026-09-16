import { useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronRight, ArrowRight } from 'lucide-react';

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Welcome to The Scroll",
      description: "A reading experience designed for reverence and discovery. Take a moment to breathe before we begin.",
    },
    {
      title: "Explore the Connections",
      description: "Every verse opens into a world of people, places, and events. Tap highlighted words to dive deeper into the historical context.",
    },
    {
      title: "Guided by the Spirit",
      description: "AI-assisted insights are provided to help clarify difficult passages, always respectfully labeled and grounded in the text.",
    }
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setLocation('/home');
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-12">
        <div className="flex gap-2 justify-center mb-12">
          {steps.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 w-12 rounded-full transition-colors duration-500 ${i <= step ? 'bg-primary' : 'bg-secondary'}`}
            />
          ))}
        </div>

        <div className="space-y-6 text-center animate-in slide-in-from-right-8 fade-in duration-500" key={step}>
          <h1 className="font-serif text-3xl font-medium text-foreground md:text-4xl">
            {steps[step].title}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {steps[step].description}
          </p>
        </div>

        <div className="flex justify-center pt-8">
          <button
            onClick={nextStep}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-medium text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
          >
            {step === steps.length - 1 ? "Enter The Scroll" : "Continue"}
            {step === steps.length - 1 ? <ArrowRight className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
