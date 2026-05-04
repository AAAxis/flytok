import { base44 } from '@/api/base44Client';

// Score weights for different actions
const SCORE_WEIGHTS = {
  like: 5,
  save: 8,
  comment: 6,
  share: 7,
  search: 4,
  profile_visit: 3,
  watch_25: 1,
  watch_50: 2,
  watch_75: 4,
  watch_100: 6
};

// Update user preference scores for hashtags and creators
export async function updatePreferenceScore(userEmail, hashtags, action, creatorEmail = null) {
  if (!userEmail) return;
  
  const score = SCORE_WEIGHTS[action] || 1;
  
  try {
    const prefs = await base44.entities.UserPreference.filter({ user_email: userEmail });
    let userPref = prefs[0];
    
    if (!userPref) {
      userPref = await base44.entities.UserPreference.create({
        user_email: userEmail,
        country_scores: {},
        creator_scores: {},
        watch_history: [],
        recent_searches: []
      });
    }
    
    const updates = {};
    
    // Update hashtag scores
    if (hashtags?.length) {
      const currentScores = userPref.country_scores || {};
      hashtags.forEach(tag => {
        const normalizedTag = tag.toLowerCase().replace('#', '');
        currentScores[normalizedTag] = (currentScores[normalizedTag] || 0) + score;
      });
      updates.country_scores = currentScores;
    }
    
    // Update creator scores
    if (creatorEmail) {
      const creatorScores = userPref.creator_scores || {};
      creatorScores[creatorEmail] = (creatorScores[creatorEmail] || 0) + score;
      updates.creator_scores = creatorScores;
    }
    
    if (Object.keys(updates).length > 0) {
      await base44.entities.UserPreference.update(userPref.id, updates);
    }
  } catch (e) {
    console.error('Failed to update preferences:', e);
  }
}

// Track watch time for a video
export async function trackWatchTime(userEmail, videoId, watchPercent, hashtags, creatorEmail) {
  if (!userEmail || !videoId) return;
  
  let action = null;
  if (watchPercent >= 100) action = 'watch_100';
  else if (watchPercent >= 75) action = 'watch_75';
  else if (watchPercent >= 50) action = 'watch_50';
  else if (watchPercent >= 25) action = 'watch_25';
  
  if (action) {
    await updatePreferenceScore(userEmail, hashtags, action, creatorEmail);
  }
}

// Add search to recent searches
export async function addSearchHistory(userEmail, query) {
  if (!userEmail || !query) return;
  
  try {
    const prefs = await base44.entities.UserPreference.filter({ user_email: userEmail });
    let userPref = prefs[0];
    
    if (!userPref) {
      userPref = await base44.entities.UserPreference.create({
        user_email: userEmail,
        country_scores: {},
        recent_searches: [query]
      });
      return;
    }
    
    const searches = userPref.recent_searches || [];
    const updatedSearches = [query, ...searches.filter(s => s !== query)].slice(0, 10);
    
    await base44.entities.UserPreference.update(userPref.id, {
      recent_searches: updatedSearches
    });
    
    // Also boost score for searched term
    await updatePreferenceScore(userEmail, [query], 'search');
  } catch (e) {
    console.error('Failed to add search history:', e);
  }
}

// Sort videos based on user preferences
export function sortVideosByPreference(videos, userPreferences) {
  if (!userPreferences) return videos;
  
  const hashtagScores = userPreferences.country_scores || {};
  const creatorScores = userPreferences.creator_scores || {};
  
  const hasScores = Object.keys(hashtagScores).length > 0 || Object.keys(creatorScores).length > 0;
  if (!hasScores) return videos;
  
  return [...videos].sort((a, b) => {
    const scoreA = getVideoScore(a, hashtagScores, creatorScores);
    const scoreB = getVideoScore(b, hashtagScores, creatorScores);
    
    // Mix preference score with recency and engagement
    const recencyA = new Date(a.created_date).getTime() / Date.now();
    const recencyB = new Date(b.created_date).getTime() / Date.now();
    
    const engagementA = (a.likes_count || 0) + (a.comments_count || 0) * 2 + (a.shares_count || 0) * 3;
    const engagementB = (b.likes_count || 0) + (b.comments_count || 0) * 2 + (b.shares_count || 0) * 3;
    
    // 50% preference, 30% recency, 20% engagement
    const finalA = scoreA * 0.5 + recencyA * 0.3 + Math.min(engagementA / 100, 1) * 0.2;
    const finalB = scoreB * 0.5 + recencyB * 0.3 + Math.min(engagementB / 100, 1) * 0.2;
    
    return finalB - finalA;
  });
}

function getVideoScore(video, hashtagScores, creatorScores) {
  let score = 0;
  
  // Hashtag relevance
  if (video.hashtags?.length) {
    score += video.hashtags.reduce((total, tag) => {
      const normalizedTag = tag.toLowerCase().replace('#', '');
      return total + (hashtagScores[normalizedTag] || 0);
    }, 0);
  }
  
  // Creator preference
  if (video.creator_email && creatorScores[video.creator_email]) {
    score += creatorScores[video.creator_email] * 2;
  }
  
  return score;
}