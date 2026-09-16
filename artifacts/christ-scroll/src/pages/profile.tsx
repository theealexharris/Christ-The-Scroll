import { useState } from 'react';
import { User, Settings, BookOpen, Clock, ChevronRight, LogOut } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function Profile() {
  const [preferences, setPreferences] = useState({
    discoveryMode: true,
    notifications: false,
    aiAssist: true
  });

  const togglePreference = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col gap-10 p-6 md:p-10 animate-in fade-in duration-500 max-w-2xl mx-auto w-full">
      <header className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-8 w-8" />
        </div>
        <div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-foreground md:text-4xl">
            Guest Reader
          </h1>
          <p className="text-muted-foreground mt-1">Reading since today</p>
        </div>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center text-center">
          <BookOpen className="h-6 w-6 text-primary mb-3" />
          <span className="text-3xl font-serif font-medium text-foreground">12</span>
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground mt-1">Chapters Read</span>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center justify-center text-center">
          <Clock className="h-6 w-6 text-primary mb-3" />
          <span className="text-3xl font-serif font-medium text-foreground">4</span>
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground mt-1">Journeys Taken</span>
        </div>
      </section>

      {/* Settings */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 border-b border-border pb-2 text-foreground">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-serif text-xl font-medium">Reading Preferences</h2>
        </div>
        
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1 pr-6">
              <Label htmlFor="discovery" className="text-base font-medium">Default to Discovery Mode</Label>
              <p className="text-sm text-muted-foreground">Always highlight people, places, and events when opening a chapter.</p>
            </div>
            <Switch 
              id="discovery" 
              checked={preferences.discoveryMode} 
              onCheckedChange={() => togglePreference('discoveryMode')} 
            />
          </div>
          
          <div className="h-px bg-border w-full" />
          
          <div className="flex items-center justify-between">
            <div className="space-y-1 pr-6">
              <Label htmlFor="ai" className="text-base font-medium">AI-Assisted Explanations</Label>
              <p className="text-sm text-muted-foreground">Show AI insights and context panels when exploring verses.</p>
            </div>
            <Switch 
              id="ai" 
              checked={preferences.aiAssist} 
              onCheckedChange={() => togglePreference('aiAssist')} 
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="pt-4">
        <button className="flex w-full items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-destructive hover:bg-destructive/10 transition-colors">
          <div className="flex items-center gap-3 font-medium">
            <LogOut className="h-5 w-5" />
            Sign Out
          </div>
          <ChevronRight className="h-5 w-5" />
        </button>
      </section>
    </div>
  );
}
