import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const INTERESTS = [
  'Culture & History', 'Food & Dining', 'Adventure', 'Nature', 
  'Nightlife', 'Shopping', 'Relaxation', 'Photography', 'Art', 'Local Experience'
];

const TRAVEL_STYLES = [
  { id: 'budget', label: 'Budget', desc: 'Hostels, street food, public transport' },
  { id: 'comfort', label: 'Comfort', desc: 'Hotels, restaurants, mix of transport' },
  { id: 'luxury', label: 'Luxury', desc: 'Premium hotels, fine dining, private tours' },
];

export default function ItineraryForm({ onGenerate, isGenerating }) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [travelStyle, setTravelStyle] = useState('comfort');
  const [interests, setInterests] = useState([]);

  const toggleInterest = (interest) => {
    setInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = () => {
    if (!destination || !startDate || !endDate) return;
    onGenerate({
      destination,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      travel_style: travelStyle,
      interests
    });
  };

  return (
    <div className="space-y-6">
      {/* Destination */}
      <div>
        <Label className="text-white mb-2 block">Where do you want to go?</Label>
        <Input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="e.g., Tokyo, Japan"
          className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-12 text-lg"
        />
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-white mb-2 block">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, 'MMM d, yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label className="text-white mb-2 block">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, 'MMM d, yyyy') : 'Pick date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                disabled={(date) => date < (startDate || new Date())}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Travel Style */}
      <div>
        <Label className="text-white mb-3 block">Travel Style</Label>
        <div className="grid grid-cols-3 gap-3">
          {TRAVEL_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setTravelStyle(style.id)}
              className={cn(
                "p-3 rounded-xl border-2 transition-all text-left",
                travelStyle === style.id
                  ? "border-rose-500 bg-rose-500/10"
                  : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
              )}
            >
              <p className="text-white font-medium text-sm">{style.label}</p>
              <p className="text-zinc-500 text-xs mt-1">{style.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div>
        <Label className="text-white mb-3 block">Interests (select multiple)</Label>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((interest) => (
            <button
              key={interest}
              onClick={() => toggleInterest(interest)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                interests.includes(interest)
                  ? "bg-rose-500 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              )}
            >
              {interest}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={handleSubmit}
        disabled={!destination || !startDate || !endDate || isGenerating}
        className="w-full h-14 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white font-semibold text-lg rounded-xl"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Creating your itinerary...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Generate Itinerary
          </>
        )}
      </Button>
    </div>
  );
}