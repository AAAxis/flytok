import { useQuery } from '@tanstack/react-query';
import { Users, Video, Flag, Eye, Activity } from 'lucide-react';
import { usersRepo, videosRepo, activityRepo } from '@/lib/repositories';
import StatCard from '@/components/admin/StatCard';
import SignupChart from '@/components/admin/SignupChart';
import ActivityFeed from '@/components/admin/ActivityFeed';

export default function Dashboard() {
  const userCount = useQuery({ queryKey: ['count', 'users'], queryFn: usersRepo.count });
  const videoCount = useQuery({ queryKey: ['count', 'videos'], queryFn: videosRepo.count });
  const activity = useQuery({
    queryKey: ['activity', 'recent'],
    queryFn: () => activityRepo.recent({ pageSize: 15 }),
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
        <p className="text-sm text-zinc-500">Real-time view of Flytok activity.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <StatCard
          label="Total users"
          value={userCount.data}
          isLoading={userCount.isLoading}
          error={userCount.error}
          icon={Users}
        />
        <StatCard
          label="Videos uploaded"
          value={videoCount.data}
          isLoading={videoCount.isLoading}
          error={videoCount.error}
          icon={Video}
        />
        <StatCard
          label="Reports pending"
          value={0}
          icon={Flag}
        />
        <StatCard
          label="Watch minutes (24h)"
          value={null}
          icon={Eye}
        />
        <StatCard
          label="Active now"
          value={null}
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SignupChart />
        </div>
        <div>
          <ActivityFeed items={activity.data ?? []} isLoading={activity.isLoading} />
        </div>
      </div>
    </div>
  );
}
