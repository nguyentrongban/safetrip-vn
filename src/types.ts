export interface GeoPoint { lat: number; lng: number }
export interface BorderPoint extends GeoPoint { id: string; name: string; province: string; country: string; dangerNote: string }
export type RiskLevel = 'HIGH' | 'CRITICAL';
export interface BlacklistEntry { id: string; plate: string; company: string; phone: string; reason: string; risk: RiskLevel; reports: number; lastSeen: string }
export interface PersonalReport { id: string; plate: string; company: string; description: string; imageDataUrl: string | null; createdAt: number }
export interface CommunityFraudEntry { plate: string; plateDisplay: string; operatorName: string; phone: string; scamType: string; area: string; description: string; imageUrls: string[]; reportCount: number; createdAt: string }
export interface SOSConfig { phone1: string; phone2: string; message: string }
export interface TripConfig { destination: string; hours: number; startedAt: number }
export type TabId = 'home' | 'monitor' | 'search' | 'handbook';
