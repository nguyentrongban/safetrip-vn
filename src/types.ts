export interface GeoPoint { lat: number; lng: number }
export interface BorderPoint extends GeoPoint { id: string; name: string; province: string; country: string; dangerNote: string }
export type RiskLevel = 'HIGH' | 'CRITICAL';
export interface BlacklistEntry { id: string; plate: string; company: string; phone: string; reason: string; risk: RiskLevel; reports: number; lastSeen: string }
export interface PersonalReport { id: string; plate: string; company: string; description: string; imageDataUrl: string | null; createdAt: number }
export interface CommunityFraudEntry { plate: string; plateDisplay: string; operatorName: string; phone: string; scamType: string; area: string; description: string; imageUrls: string[]; reportCount: number; plateCount: number; phoneCount: number; createdAt: string }
export interface SOSConfig { phone1: string; phone2: string; message: string }
/** A picked place: a real point on the map with a human-readable name. */
export interface PlacePoint { lat: number; lng: number; name: string }

export interface TripConfig {
  destination: string;
  /** Planned trip length in hours. Since v1.29 this is filled in
   * automatically from the predicted route (was a manual slider). */
  hours: number;
  startedAt: number;
  /* v1.29 route-aware fields — absent on trips started before v1.29. */
  destLat?: number;
  destLng?: number;
  startName?: string;
  startLat?: number;
  startLng?: number;
  /** Simplified predicted-route polyline, [lat, lng] pairs. */
  route?: [number, number][];
  distanceKm?: number;
  durationMin?: number;
}
export type TabId = 'home' | 'monitor' | 'search' | 'handbook';
