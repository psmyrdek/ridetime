import data from '../data/strava.json';

export interface StravaStats {
  year: number;
  ytd: {
    rides: number;
    distanceKm: number;
    elevationM: number | null;
    movingTimeH: number | null;
  };
  latestActivity: {
    id: number;
    name: string;
    sportType: string;
    distanceKm: number;
    elevationM: number;
    startDate: string;
  } | null;
}

export const strava = data as StravaStats;
