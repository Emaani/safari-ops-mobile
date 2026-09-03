/** @type {import('@expo/eas-metadata').Config} */
module.exports = {
  apple: {
    info: {
      'en-US': {
        title: 'Jackal Adventures',
        subtitle: 'Safari Operations Manager',
        description: `Jackal Adventures is a professional safari operations management platform built for tour operators in East Africa.

Manage your entire safari business from one intuitive app:

FLEET MANAGEMENT
• Real-time vehicle availability and status tracking
• Maintenance schedule monitoring and repair logging
• Driver assignment and capacity management across 5-seater and 7-seater vehicles
• Fleet utilisation analytics at a glance

BOOKING MANAGEMENT
• Create, track, and manage safari bookings end-to-end
• Client profiles, package types, and payment tracking
• Instant status updates — Pending, In Progress, Completed
• Outstanding payments dashboard

FINANCIAL DASHBOARD
• Revenue vs Expenses charts with monthly breakdowns
• Cash Requisition management with multi-level approval workflows
• KPIs: Total Revenue, Total Expenses, Fleet Utilisation, Active Bookings
• Multi-currency support: USD, UGX, KES

SAFARI MANAGEMENT
• Manage safari packages and tour itineraries
• Vehicle and driver assignment per safari
• Safari performance and revenue tracking

LIVE OPERATIONS
• Real-time data sync across your entire team
• In-app notifications for new bookings and approvals
• Secure Face ID / Touch ID sign-in
• Works seamlessly on iPhone and iPad

Built for the fast-paced world of safari tour operations. Jackal Adventures keeps your fleet moving, your team aligned, and your finances clear.

Requires an authorised Jackal Adventures account.`,

        keywords: [
          'safari',
          'operations',
          'fleet',
          'booking',
          'management',
          'tours',
          'wildlife',
          'Uganda',
          'Kenya',
          'finance',
        ],

        releaseNotes: `Version 1.1.0 — UX & Performance Update

• Dashboard KPI cards now animate in on load
• Recent Bookings now shows full trip date range (start – end)
• In-Progress badge has a live pulsing indicator
• Revenue vs Expenses chart: tap a month for an animated detail card
• Haptic feedback on quick-action buttons and filter chips
• Live dot indicator on the header pulses in real time
• New booking and cash requisition confirmations now use in-app banners
• Chart utilities consolidated for consistency across all finance views`,

        promoText: 'Now with live fleet tracking, in-app notifications, and multi-currency financial dashboards — built for East Africa\'s safari industry.',

        // Replace with your actual public support URL
        supportUrl: 'https://jackaladventures.com/support',

        // Replace with your actual public privacy policy URL — REQUIRED for App Store
        privacyPolicyUrl: 'https://jackaladventures.com/privacy',
      },
    },

    categories: ['TRAVEL', 'BUSINESS'],

    ageRatingDeclaration: {
      violenceCartoonOrFantasy: 'NONE',
      violenceRealistic: 'NONE',
      violenceRealisticProlongedGraphicOrSadistic: 'NONE',
      profanityOrCrudeHumor: 'NONE',
      matureOrSuggestiveThemes: 'NONE',
      horrorOrFearThemes: 'NONE',
      medicalOrTreatmentInformation: 'NONE',
      alcoholTobaccoOrDrugUseOrReferences: 'NONE',
      gamblingSimulated: 'NONE',
      sexualContentOrNudity: 'NONE',
      sexualContentGraphicAndNudity: 'NONE',
      unrestrictedWebAccess: 'NONE',
      gamblingAndContests: 'NONE',
    },
  },
};
