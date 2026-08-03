import { getLaunchHealth } from '../lib/healthConfig.js';

export default async function handler(req: any, res: any) {
  res.status(200).json({
    ...getLaunchHealth(process.env),
    mobileBuilder: {
      daytonaConfigured: Boolean(process.env.DAYTONA_API_KEY?.trim()),
      convexConfigured: Boolean((process.env.CONVEX_URL || process.env.VITE_CONVEX_URL)?.trim()),
      builderApiBaseUrlConfigured: Boolean(process.env.BUILDER_API_BASE_URL?.trim()),
    },
  });
}
