export class JackalSDK {
  static initialize(config: { supabase: { url: string; anonKey: string }; eas: { projectId: string } }) {
    // Do not log config — it contains credentials
    return new JackalSDK();
  }

  async start() {
    // SDK started — no logging in production
  }
}