import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, GripVertical, Edit2, Trash2, Clock, MapPin, MessageSquare, Save, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function CollaborativeEditor({ itinerary, currentUser, onUpdate, isCollaborator }) {
  const [editingDay, setEditingDay] = useState(null);
  const [editingActivity, setEditingActivity] = useState(null);
  const [newActivity, setNewActivity] = useState({ time: '', title: '', description: '', location: '' });
  const [addingToDay, setAddingToDay] = useState(null);
  const [saving, setSaving] = useState(false);

  const canEdit = itinerary.user_email === currentUser?.email || isCollaborator;

  if (!canEdit) {
    return null;
  }

  const handleAddActivity = async (dayIndex) => {
    if (!newActivity.title.trim()) return;
    
    setSaving(true);
    const itineraryData = { ...itinerary.itinerary_data };
    const day = itineraryData.days[dayIndex];
    
    day.activities.push({
      time: newActivity.time || '12:00',
      title: newActivity.title,
      description: newActivity.description,
      location: newActivity.location,
      addedBy: currentUser.email,
      addedAt: new Date().toISOString()
    });

    await base44.entities.Itinerary.update(itinerary.id, { itinerary_data: itineraryData });
    
    // Log the edit
    await base44.entities.ItineraryEdit.create({
      itinerary_id: itinerary.id,
      editor_email: currentUser.email,
      editor_name: currentUser.full_name,
      edit_type: 'add_activity',
      day_index: dayIndex,
      content: newActivity
    });

    setNewActivity({ time: '', title: '', description: '', location: '' });
    setAddingToDay(null);
    setSaving(false);
    onUpdate?.();
    toast.success('Activity added!');
  };

  const handleEditActivity = async (dayIndex, activityIndex, updates) => {
    setSaving(true);
    const itineraryData = { ...itinerary.itinerary_data };
    itineraryData.days[dayIndex].activities[activityIndex] = {
      ...itineraryData.days[dayIndex].activities[activityIndex],
      ...updates,
      editedBy: currentUser.email,
      editedAt: new Date().toISOString()
    };

    await base44.entities.Itinerary.update(itinerary.id, { itinerary_data: itineraryData });
    
    await base44.entities.ItineraryEdit.create({
      itinerary_id: itinerary.id,
      editor_email: currentUser.email,
      editor_name: currentUser.full_name,
      edit_type: 'edit_activity',
      day_index: dayIndex,
      activity_index: activityIndex,
      content: updates
    });

    setEditingActivity(null);
    setSaving(false);
    onUpdate?.();
    toast.success('Activity updated!');
  };

  const handleDeleteActivity = async (dayIndex, activityIndex) => {
    setSaving(true);
    const itineraryData = { ...itinerary.itinerary_data };
    const removed = itineraryData.days[dayIndex].activities.splice(activityIndex, 1);

    await base44.entities.Itinerary.update(itinerary.id, { itinerary_data: itineraryData });
    
    await base44.entities.ItineraryEdit.create({
      itinerary_id: itinerary.id,
      editor_email: currentUser.email,
      editor_name: currentUser.full_name,
      edit_type: 'remove_activity',
      day_index: dayIndex,
      activity_index: activityIndex,
      content: removed[0]
    });

    setSaving(false);
    onUpdate?.();
    toast.success('Activity removed');
  };

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <Users className="w-4 h-4" />
        <span>Collaborative editing enabled</span>
      </div>

      {itinerary.itinerary_data?.days?.map((day, dayIndex) => (
        <div key={dayIndex} className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
          <h3 className="text-white font-semibold mb-3">Day {day.day}: {day.title}</h3>
          
          <div className="space-y-2">
            {day.activities?.map((activity, actIndex) => (
              <motion.div
                key={actIndex}
                layout
                className="bg-zinc-800/50 rounded-lg p-3 group"
              >
                {editingActivity?.dayIndex === dayIndex && editingActivity?.actIndex === actIndex ? (
                  <EditActivityForm
                    activity={activity}
                    onSave={(updates) => handleEditActivity(dayIndex, actIndex, updates)}
                    onCancel={() => setEditingActivity(null)}
                    saving={saving}
                  />
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                        <Clock className="w-3 h-3" />
                        <span>{activity.time}</span>
                        {activity.location && (
                          <>
                            <MapPin className="w-3 h-3 ml-2" />
                            <span>{activity.location}</span>
                          </>
                        )}
                      </div>
                      <p className="text-white font-medium">{activity.title}</p>
                      {activity.description && (
                        <p className="text-zinc-400 text-sm mt-1">{activity.description}</p>
                      )}
                      {activity.addedBy && activity.addedBy !== itinerary.user_email && (
                        <p className="text-zinc-500 text-xs mt-2">
                          Added by {activity.addedBy}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingActivity({ dayIndex, actIndex })}
                        className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteActivity(dayIndex, actIndex)}
                        className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Add activity form */}
          <AnimatePresence>
            {addingToDay === dayIndex ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 bg-zinc-800 rounded-lg p-3 space-y-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="time"
                    value={newActivity.time}
                    onChange={(e) => setNewActivity({ ...newActivity, time: e.target.value })}
                    placeholder="Time"
                    className="bg-zinc-700 border-zinc-600 text-white"
                  />
                  <Input
                    value={newActivity.location}
                    onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                    placeholder="Location"
                    className="bg-zinc-700 border-zinc-600 text-white"
                  />
                </div>
                <Input
                  value={newActivity.title}
                  onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                  placeholder="Activity title"
                  className="bg-zinc-700 border-zinc-600 text-white"
                />
                <Textarea
                  value={newActivity.description}
                  onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                  placeholder="Description (optional)"
                  className="bg-zinc-700 border-zinc-600 text-white h-20"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setAddingToDay(null)}
                    className="flex-1 text-zinc-400"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => handleAddActivity(dayIndex)}
                    disabled={saving || !newActivity.title.trim()}
                    className="flex-1 bg-rose-500 hover:bg-rose-600"
                  >
                    {saving ? 'Adding...' : 'Add Activity'}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <button
                onClick={() => setAddingToDay(dayIndex)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Add activity</span>
              </button>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

function EditActivityForm({ activity, onSave, onCancel, saving }) {
  const [data, setData] = useState({
    time: activity.time || '',
    title: activity.title || '',
    description: activity.description || '',
    location: activity.location || ''
  });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="time"
          value={data.time}
          onChange={(e) => setData({ ...data, time: e.target.value })}
          className="bg-zinc-700 border-zinc-600 text-white text-sm"
        />
        <Input
          value={data.location}
          onChange={(e) => setData({ ...data, location: e.target.value })}
          placeholder="Location"
          className="bg-zinc-700 border-zinc-600 text-white text-sm"
        />
      </div>
      <Input
        value={data.title}
        onChange={(e) => setData({ ...data, title: e.target.value })}
        placeholder="Title"
        className="bg-zinc-700 border-zinc-600 text-white text-sm"
      />
      <Textarea
        value={data.description}
        onChange={(e) => setData({ ...data, description: e.target.value })}
        placeholder="Description"
        className="bg-zinc-700 border-zinc-600 text-white text-sm h-16"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} className="flex-1 text-zinc-400">
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(data)} disabled={saving} className="flex-1 bg-emerald-500 hover:bg-emerald-600">
          <Save className="w-3 h-3 mr-1" />
          Save
        </Button>
      </div>
    </div>
  );
}