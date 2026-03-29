export class JackalSDK {
  static initialize(config: { supabase: { url: string; anonKey: string }; eas: { projectId: string } }) {
    console.log('Initializing JackalSDK with config:', config);
    return new JackalSDK();
  }

  async start() {
    console.log('JackalSDK started');
  }
}