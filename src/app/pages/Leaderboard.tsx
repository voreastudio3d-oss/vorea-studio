import { useEffect, useState } from "react";
import { Link } from "../nav";
import { useI18n } from "../services/i18n-context";
import { RewardsApi } from "../services/api-client";

// Define the type for leaderboard items based on backend response
interface LeaderboardItem {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  points: number;
  level: number;
  badges: any[];
}

export function Leaderboard() {
  const { t } = useI18n();

  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchLeaderboard() {
      try {
        setIsLoading(true);
        const data = await RewardsApi.getLeaderboard(50);
        if (active) {
          setLeaderboard(data);
          setError(null);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Failed to load leaderboard");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }
    fetchLeaderboard();

    return () => {
      active = false;
    };
  }, []);

  // Separate top 3 from the rest
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="min-h-screen bg-[#070708] text-gray-200">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-20">
        
        {/* Header section */}
        <div className="text-center mb-16 relative">
          <div className="absolute inset-0 bg-blue-500/10 blur-[100px] rounded-full w-96 h-96 mx-auto top-0 -z-10 pointer-events-none" />
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-white">
            {t("leaderboard.title")}
          </h1>
          <p className="max-w-2xl mx-auto text-lg text-gray-400">
            {t("leaderboard.subtitle")}
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-32 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
            <p className="text-gray-400 font-medium">{t("common.loading")}</p>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-red-500/10 rounded-2xl border border-red-500/20">
            <p className="text-red-400">{error}</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-20 bg-[#121215] rounded-2xl border border-white/5">
            <p className="text-gray-500">{t("leaderboard.empty")}</p>
          </div>
        ) : (
          <div className="space-y-16">
            
            {/* Top 3 Podium */}
            {top3.length > 0 && (
              <div className="flex flex-col md:flex-row items-end justify-center gap-4 sm:gap-6 lg:gap-8 px-4 relative">
                
                {/* 2nd Place */}
                {top3[1] && (
                  <PodiumPosition
                    user={top3[1]}
                    position={2}
                    height="h-[220px]"
                    color="from-slate-300 to-slate-500"
                    glowColor="bg-slate-400/20"
                    t={t}
                  />
                )}

                {/* 1st Place */}
                {top3[0] && (
                  <PodiumPosition
                    user={top3[0]}
                    position={1}
                    height="h-[280px]"
                    color="from-amber-300 to-amber-600"
                    glowColor="bg-amber-400/30"
                    t={t}
                    isWinner
                  />
                )}

                {/* 3rd Place */}
                {top3[2] && (
                  <PodiumPosition
                    user={top3[2]}
                    position={3}
                    height="h-[180px]"
                    color="from-orange-400 to-orange-700"
                    glowColor="bg-orange-500/20"
                    t={t}
                  />
                )}
              </div>
            )}

            {/* The Rest of the Ranking */}
            {rest.length > 0 && (
              <div className="max-w-4xl mx-auto rounded-2xl border border-white/10 bg-[#121215]/80 backdrop-blur-md overflow-hidden shadow-2xl">
                <div className="grid grid-cols-12 gap-4 p-4 sm:px-6 bg-[#0f0f13] border-b border-white/5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-2 sm:col-span-1 text-center">{t("leaderboard.rank")}</div>
                  <div className="col-span-6 sm:col-span-6 pl-2">{t("leaderboard.user")}</div>
                  <div className="col-span-4 sm:col-span-2 flex justify-center">{t("leaderboard.level")}</div>
                  <div className="hidden sm:flex sm:col-span-3 justify-end pr-4">{t("leaderboard.points")}</div>
                </div>
                
                <div className="divide-y divide-white/5">
                  {rest.map((user, idx) => (
                    <ListPosition key={user.userId} user={user} position={idx + 4} t={t} />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function PodiumPosition({ 
  user, 
  position, 
  height, 
  color, 
  glowColor,
  t,
  isWinner = false 
}: { 
  user: LeaderboardItem; 
  position: number; 
  height: string; 
  color: string;
  glowColor: string;
  t: any;
  isWinner?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center w-full md:w-1/3 max-w-[240px] relative order-${position === 1 ? '1 md:order-2' : position === 2 ? '2 md:order-1' : '3'}`}>
      
      {/* Glow Effect */}
      <div className={`absolute top-0 -translate-y-1/2 w-32 h-32 rounded-full blur-[60px] ${glowColor} -z-10`} />
      
      {/* Avatar & User Info */}
      <Link 
        to={`/user/${user.userId}`} 
        className="flex flex-col items-center mb-6 group transition-transform hover:-translate-y-2 z-10"
      >
        <div className="relative mb-4">
          <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[2px] bg-gradient-to-b ${color} shadow-lg ${isWinner ? 'shadow-amber-500/40' : ''}`}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full rounded-full object-cover bg-black" />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center text-gray-400 text-3xl font-bold">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          {/* Position Badge */}
          <div className={`absolute -bottom-3 -right-2 w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-black font-black shadow-lg border-2 border-[#070708] text-sm`}>
            {position}
          </div>
        </div>
        
        <h3 className="text-white font-bold text-lg text-center leading-tight max-w-[200px] truncate group-hover:text-blue-400 transition-colors">
          {user.displayName}
        </h3>
        <p className="text-blue-400 font-medium text-sm">
          {user.username}
        </p>
      </Link>
      
      {/* Podium Pillar */}
      <div className={`w-full ${height} rounded-t-2xl bg-gradient-to-b from-white/[0.08] to-transparent border-t border-x border-white/10 relative overflow-hidden backdrop-blur-sm shadow-2xl flex flex-col items-center pt-6`}>
        {/* Top Highlight line */}
        <div className={`absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r ${color} opacity-70`} />
        
        <div className="flex flex-col items-center opacity-80">
          <span className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-1">
            {t("leaderboard.level")}
          </span>
          <span className="text-3xl font-black text-white relative">
            {user.level}
            <span className={`absolute -inset-2 bg-gradient-to-r ${color} opacity-20 blur-md -z-10 rounded-full`} />
          </span>
        </div>
        
        <div className="mt-auto pb-6 text-center">
          <span className="block text-xl font-bold text-white tracking-widest">
            {user.points.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-widest mt-1">
            XP
          </span>
        </div>
      </div>
    </div>
  );
}

function ListPosition({ user, position, t }: { user: LeaderboardItem; position: number; t: any }) {
  return (
    <Link 
      to={`/user/${user.userId}`}
      className="grid grid-cols-12 gap-4 p-4 sm:px-6 items-center hover:bg-white/5 transition-colors group cursor-pointer"
    >
      {/* Rank */}
      <div className="col-span-2 sm:col-span-1 text-center">
        <span className="text-lg font-bold text-gray-500 group-hover:text-gray-300 transition-colors">
          {position}
        </span>
      </div>
      
      {/* User Info */}
      <div className="col-span-6 sm:col-span-6 flex items-center gap-4 pl-2">
        <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden shrink-0 border border-white/10 group-hover:border-white/30 transition-colors">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-white font-medium truncate group-hover:text-blue-400 transition-colors">
            {user.displayName}
          </span>
          <span className="text-gray-500 text-xs truncate">
            {user.username}
          </span>
        </div>
      </div>
      
      {/* Level */}
      <div className="col-span-4 sm:col-span-2 flex justify-center">
        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm font-semibold text-gray-300">
          Lv. {user.level}
        </div>
      </div>
      
      {/* Points */}
      <div className="hidden sm:flex sm:col-span-3 flex-col items-end pr-4">
        <span className="text-gray-300 font-bold font-mono">
          {user.points.toLocaleString()}
        </span>
        <span className="text-xs font-medium text-gray-500 uppercase">
          XP
        </span>
      </div>
    </Link>
  );
}
