import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MapPin, Clock, DollarSign, Hotel, Utensils, Camera, 
  Car, Plane, Train, ArrowLeft, Download, Bookmark, Share2,
  Sun, Sunrise, Moon, Edit2, Users
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import CollaborativeEditor from './CollaborativeEditor';

const timeIcons = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon
};

export default function ItineraryView({ 
  itinerary, 
  onBack, 
  onSave, 
  onExport, 
  onShare,
  onEdit,
  isSaved,
  canEdit,
  editMode,
  currentUser,
  isCollaborator,
  onUpdate
}) {
  const data = itinerary.itinerary_data;
  
  if (!data) return null;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="relative h-64">
        <img 
          src={itinerary.cover_image || `https://source.unsplash.com/800x400/?${itinerary.destination},travel`}
          alt={itinerary.destination}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        
        <button 
          onClick={onBack}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-bold text-white mb-1">{itinerary.title || `Trip to ${itinerary.destination}`}</h1>
          <div className="flex items-center gap-3 text-zinc-300 text-sm">
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {itinerary.destination}
            </span>
            <span>•</span>
            <span>{format(new Date(itinerary.start_date), 'MMM d')} - {format(new Date(itinerary.end_date), 'MMM d, yyyy')}</span>
          </div>
        </div>
      </div>

      {/* Collaborators indicator */}
      {itinerary.collaborators?.length > 0 && (
        <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <span className="text-blue-400 text-sm">
            {itinerary.collaborators.length} collaborator{itinerary.collaborators.length > 1 ? 's' : ''}
          </span>
          {isCollaborator && (
            <span className="text-zinc-400 text-xs ml-auto">You're a collaborator</span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 p-4 border-b border-zinc-800">
        <Button 
          onClick={onSave}
          variant="outline" 
          className={cn(
            "flex-1 border-zinc-700",
            isSaved ? "bg-amber-500/20 border-amber-500 text-amber-400" : "text-white"
          )}
        >
          <Bookmark className={cn("w-4 h-4 mr-2", isSaved && "fill-amber-400")} />
          {isSaved ? 'Saved' : 'Save'}
        </Button>
        <Button onClick={onExport} variant="outline" className="flex-1 border-zinc-700 text-white">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
        <Button onClick={onShare} variant="outline" className="border-zinc-700 text-white">
          <Share2 className="w-4 h-4" />
        </Button>
        {canEdit && (
          <Button 
            onClick={onEdit} 
            variant="outline" 
            className={cn(
              "border-zinc-700",
              editMode ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "text-white"
            )}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Overview */}
      {data.overview && (
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-white font-semibold mb-2">Overview</h3>
          <p className="text-zinc-400 text-sm leading-relaxed">{data.overview}</p>
        </div>
      )}

      {/* Quick Info */}
      <div className="grid grid-cols-3 gap-3 p-4 border-b border-zinc-800">
        {data.accommodation && (
          <div className="bg-zinc-900 rounded-xl p-3">
            <Hotel className="w-5 h-5 text-rose-400 mb-1" />
            <p className="text-zinc-500 text-xs">Stay</p>
            <p className="text-white text-sm font-medium truncate">{data.accommodation.type}</p>
          </div>
        )}
        {data.budget && (
          <div className="bg-zinc-900 rounded-xl p-3">
            <DollarSign className="w-5 h-5 text-green-400 mb-1" />
            <p className="text-zinc-500 text-xs">Budget</p>
            <p className="text-white text-sm font-medium">{data.budget}</p>
          </div>
        )}
        {data.transportation && (
          <div className="bg-zinc-900 rounded-xl p-3">
            <Car className="w-5 h-5 text-blue-400 mb-1" />
            <p className="text-zinc-500 text-xs">Transport</p>
            <p className="text-white text-sm font-medium truncate">{data.transportation}</p>
          </div>
        )}
      </div>

      {/* Collaborative Editor */}
      {editMode && canEdit && (
        <div className="p-4 border-b border-zinc-800">
          <CollaborativeEditor
            itinerary={itinerary}
            currentUser={currentUser}
            onUpdate={onUpdate}
            isCollaborator={isCollaborator}
          />
        </div>
      )}

      {/* Daily Itinerary */}
      <ScrollArea className="pb-24">
        <div className="p-4 space-y-6">
          <h3 className="text-white font-semibold">Daily Plan</h3>
          
          {data.days?.map((day, dayIndex) => (
            <div key={dayIndex} className="relative">
              {/* Day header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
                  <span className="text-white font-bold">{dayIndex + 1}</span>
                </div>
                <div>
                  <p className="text-white font-semibold">Day {dayIndex + 1}</p>
                  <p className="text-zinc-500 text-sm">{day.title || day.theme}</p>
                </div>
              </div>

              {/* Activities */}
              <div className="ml-6 pl-6 border-l-2 border-zinc-800 space-y-4">
                {day.activities?.map((activity, actIndex) => {
                  const TimeIcon = timeIcons[activity.time_of_day] || Sun;
                  return (
                    <div key={actIndex} className="relative">
                      <div className="absolute -left-[29px] w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-700" />
                      <div className="bg-zinc-900/50 rounded-xl p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <TimeIcon className="w-4 h-4 text-amber-400" />
                            <span className="text-zinc-400 text-xs capitalize">{activity.time_of_day || 'Day'}</span>
                            {activity.duration && (
                              <span className="text-zinc-500 text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {activity.duration}
                              </span>
                            )}
                          </div>
                        </div>
                        <h4 className="text-white font-medium mb-1">{activity.name}</h4>
                        <p className="text-zinc-400 text-sm">{activity.description}</p>
                        {activity.tips && (
                          <p className="text-rose-400 text-xs mt-2">💡 {activity.tips}</p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Meals */}
                {day.meals && (
                  <div className="relative">
                    <div className="absolute -left-[29px] w-4 h-4 rounded-full bg-orange-500" />
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Utensils className="w-4 h-4 text-orange-400" />
                        <span className="text-orange-400 text-sm font-medium">Food Recommendations</span>
                      </div>
                      <p className="text-zinc-300 text-sm">{day.meals}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}