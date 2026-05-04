import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, MapPin, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import ItineraryForm from '@/components/itinerary/ItineraryForm';
import ItineraryView from '@/components/itinerary/ItineraryView';
import ShareModal from '@/components/itinerary/ShareModal';
import CollaborativeEditor from '@/components/itinerary/CollaborativeEditor';

export default function Itinerary() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('list'); // list, create, view
  const [selectedItinerary, setSelectedItinerary] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const queryClient = useQueryClient();

  // Check for shared itinerary ID in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedId = urlParams.get('id');
    if (sharedId) {
      loadSharedItinerary(sharedId);
    }
  }, []);

  const loadSharedItinerary = async (id) => {
    const itineraries = await base44.entities.Itinerary.filter({ id });
    if (itineraries.length > 0) {
      setSelectedItinerary(itineraries[0]);
      setView('view');
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        // Allow viewing shared itineraries without login
      }
    };
    fetchUser();
  }, []);

  // Fetch user's own itineraries
  const { data: ownItineraries = [], isLoading } = useQuery({
    queryKey: ['itineraries', user?.email],
    queryFn: () => base44.entities.Itinerary.filter({ user_email: user.email }, '-created_date'),
    enabled: !!user?.email,
  });

  // Fetch itineraries where user is a collaborator
  const { data: allItineraries = [] } = useQuery({
    queryKey: ['allItineraries'],
    queryFn: () => base44.entities.Itinerary.list('-created_date', 100),
    enabled: !!user?.email,
  });

  const collaborativeItineraries = allItineraries.filter(
    it => it.collaborators?.includes(user?.email) && it.user_email !== user?.email
  );

  const itineraries = [...ownItineraries, ...collaborativeItineraries];

  const isCollaborator = selectedItinerary?.collaborators?.includes(user?.email);
  const canEdit = selectedItinerary?.user_email === user?.email || isCollaborator;

  const handleGenerate = async (formData) => {
    setIsGenerating(true);
    
    const prompt = `Create a detailed travel itinerary for a trip to ${formData.destination} from ${formData.start_date} to ${formData.end_date}.

Travel style: ${formData.travel_style}
Interests: ${formData.interests.join(', ') || 'general sightseeing'}

Please create a comprehensive day-by-day itinerary with specific activities, timing, and local recommendations.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Catchy trip title" },
          overview: { type: "string", description: "Brief trip overview" },
          accommodation: {
            type: "object",
            properties: {
              type: { type: "string" },
              recommendations: { type: "array", items: { type: "string" } }
            }
          },
          budget: { type: "string", description: "Estimated daily budget range" },
          transportation: { type: "string", description: "Recommended transport method" },
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                theme: { type: "string" },
                activities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      time_of_day: { type: "string", enum: ["morning", "afternoon", "evening"] },
                      duration: { type: "string" },
                      tips: { type: "string" }
                    }
                  }
                },
                meals: { type: "string" }
              }
            }
          }
        }
      }
    });

    const newItinerary = await base44.entities.Itinerary.create({
      user_email: user.email,
      destination: formData.destination,
      start_date: formData.start_date,
      end_date: formData.end_date,
      travel_style: formData.travel_style,
      interests: formData.interests,
      itinerary_data: response,
      title: response.title,
      cover_image: `https://source.unsplash.com/800x400/?${formData.destination},landmark`
    });

    setIsGenerating(false);
    queryClient.invalidateQueries({ queryKey: ['itineraries'] });
    setSelectedItinerary(newItinerary);
    setView('view');
  };

  const handleExport = () => {
    if (!selectedItinerary?.itinerary_data) return;
    
    const data = selectedItinerary.itinerary_data;
    let text = `${selectedItinerary.title}\n`;
    text += `${selectedItinerary.destination} | ${selectedItinerary.start_date} to ${selectedItinerary.end_date}\n\n`;
    text += `${data.overview}\n\n`;
    text += `Budget: ${data.budget}\nTransport: ${data.transportation}\n\n`;
    
    data.days?.forEach((day, i) => {
      text += `--- Day ${i + 1}: ${day.title || day.theme} ---\n`;
      day.activities?.forEach(act => {
        text += `• ${act.time_of_day}: ${act.name}\n  ${act.description}\n`;
      });
      if (day.meals) text += `Food: ${day.meals}\n`;
      text += '\n';
    });

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedItinerary.destination}-itinerary.txt`;
    a.click();
  };

  const handleRefresh = async () => {
    const updated = await base44.entities.Itinerary.filter({ id: selectedItinerary.id });
    if (updated.length > 0) {
      setSelectedItinerary(updated[0]);
    }
    queryClient.invalidateQueries({ queryKey: ['itineraries'] });
    queryClient.invalidateQueries({ queryKey: ['allItineraries'] });
  };

  if (view === 'view' && selectedItinerary) {
    return (
      <>
        <ItineraryView
          itinerary={selectedItinerary}
          onBack={() => { setView('list'); setSelectedItinerary(null); setEditMode(false); }}
          onSave={() => {}}
          onExport={handleExport}
          onShare={() => setShareModalOpen(true)}
          onEdit={() => setEditMode(!editMode)}
          isSaved={true}
          canEdit={canEdit}
          editMode={editMode}
          currentUser={user}
          isCollaborator={isCollaborator}
          onUpdate={handleRefresh}
        />
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          itinerary={selectedItinerary}
          onUpdate={handleRefresh}
        />
      </>
    );
  }

  if (view === 'create') {
    return (
      <div className="min-h-screen bg-black pb-24">
        <div className="sticky top-0 bg-black/90 backdrop-blur-lg border-b border-zinc-800 p-4 flex items-center gap-3 z-10">
          <button onClick={() => setView('list')}>
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-semibold text-lg">Plan Your Trip</h1>
        </div>
        <div className="p-4">
          <ItineraryForm onGenerate={handleGenerate} isGenerating={isGenerating} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-lg border-b border-zinc-800 p-4 flex items-center justify-between z-10">
        <h1 className="text-white font-bold text-xl">My Itineraries</h1>
        <Button 
          onClick={() => setView('create')}
          className="bg-rose-500 hover:bg-rose-600 rounded-full"
        >
          <Plus className="w-4 h-4 mr-1" />
          New Trip
        </Button>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : itineraries.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-10 h-10 text-zinc-600" />
            </div>
            <h3 className="text-white font-semibold mb-2">No itineraries yet</h3>
            <p className="text-zinc-500 text-sm mb-6">Create your first AI-powered travel plan</p>
            <Button onClick={() => setView('create')} className="bg-rose-500 hover:bg-rose-600">
              Plan a Trip
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {itineraries.map((item) => (
              <button
                key={item.id}
                onClick={() => { setSelectedItinerary(item); setView('view'); }}
                className="w-full bg-zinc-900 rounded-xl overflow-hidden text-left"
              >
                <div className="relative h-32">
                  <img
                    src={item.cover_image || `https://source.unsplash.com/400x200/?${item.destination}`}
                    alt={item.destination}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  {item.user_email !== user?.email && (
                    <div className="absolute top-2 right-2 bg-blue-500/80 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3 text-white" />
                      <span className="text-white text-xs">Shared</span>
                    </div>
                  )}
                  {item.collaborators?.length > 0 && item.user_email === user?.email && (
                    <div className="absolute top-2 right-2 bg-emerald-500/80 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                      <Users className="w-3 h-3 text-white" />
                      <span className="text-white text-xs">{item.collaborators.length}</span>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3">
                    <h3 className="text-white font-semibold">{item.title || item.destination}</h3>
                    <div className="flex items-center gap-2 text-zinc-400 text-xs mt-1">
                      <MapPin className="w-3 h-3" />
                      {item.destination}
                    </div>
                  </div>
                </div>
                <div className="p-3 flex items-center gap-2 text-zinc-400 text-sm">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(item.start_date), 'MMM d')} - {format(new Date(item.end_date), 'MMM d, yyyy')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}