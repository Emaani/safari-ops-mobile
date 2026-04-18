import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { darkTheme, themes, type AppTheme, type ThemeMode } from '../theme';

export type AppLanguage = 'en' | 'ar' | 'fr' | 'sw' | 'es' | 'pt';

type TranslationLeaf = string;
type TranslationTree = {
  [key: string]: TranslationLeaf | TranslationTree;
};

const STORAGE_KEYS = {
  theme: 'jackal:theme',
  language: 'jackal:language',
  biometrics: 'jackal:biometrics',
  notificationPrefs: 'jackal:notificationPrefs',
} as const;

export interface NotificationPrefs {
  masterEnabled:    boolean;
  bookingNew:       boolean;
  bookingStarted:   boolean;
  bookingCompleted: boolean;
  bookingCancelled: boolean;
  crNew:            boolean;
  crApproved:       boolean;
  messages:         boolean;
  systemAlerts:     boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  masterEnabled:    true,
  bookingNew:       true,
  bookingStarted:   true,
  bookingCompleted: true,
  bookingCancelled: true,
  crNew:            true,
  crApproved:       true,
  messages:         true,
  systemAlerts:     true,
};

const translations: Record<AppLanguage, TranslationTree> = {
  fr: {
    app: { name: 'Jackal Adventures', subtitle: 'Aperçu des opérations' },
    common: {
      dashboard: 'Tableau de bord', bookings: 'Réservations', fleet: 'Flotte',
      finance: 'Finance', more: 'Plus', notifications: 'Notifications',
      retry: 'Réessayer', cancel: 'Annuler', save: 'Enregistrer',
      logout: 'Se déconnecter', lightMode: 'Mode clair', darkMode: 'Mode sombre',
      language: 'Langue', biometric: 'Connexion biométrique',
      enabled: 'Activé', disabled: 'Désactivé', settings: 'Paramètres',
      profile: 'Profil', theme: 'Thème', currency: 'Devise', loading: 'Chargement...',
      today: "Aujourd'hui", search: 'Rechercher',
      functionalSoon: 'Cette action sera disponible à la prochaine étape du workflow.',
    },
    login: {
      welcome: 'Bienvenue', subtitle: 'Utilisez vos identifiants Jackal Adventures pour continuer.',
      email: 'Adresse e-mail', password: 'Mot de passe', forgotPassword: 'Mot de passe oublié ?',
      signIn: 'Se connecter', show: 'Afficher', hide: 'Masquer',
      biometric: 'Déverrouiller avec {{label}}', usePassword: 'Utiliser un mot de passe',
      enableBiometricTitle: 'Activer la connexion biométrique ?',
      enableBiometricMessage: 'Vous pouvez déverrouiller l\'application plus rapidement avec {{label}}.',
      invalidEmail: 'Veuillez entrer une adresse e-mail valide',
      passwordRequired: 'Le mot de passe est requis', emailRequired: "L'e-mail est requis",
      passwordLength: 'Le mot de passe doit comporter au moins 6 caractères',
      footer: 'Seul le personnel autorisé peut accéder à l\'application mobile.',
    },
    biometric: {
      title: 'Déverrouillage rapide', subtitle: 'Vérifiez votre identité pour accéder au tableau de bord.',
      promptMessage: 'Authentifiez-vous pour accéder à Jackal Adventures',
      promptDescription: 'Utilisez vos données biométriques ou le code de l\'appareil.',
      action: 'S\'authentifier', fallback: 'Utiliser un mot de passe',
      unavailable: 'L\'authentification biométrique n\'est pas disponible sur cet appareil.',
    },
    dashboard: {
      refine: 'Affiner l\'aperçu', filters: 'Filtres', tapToSwitch: 'Appuyer pour changer',
      month: 'Mois', year: 'Année', revenueFocus: 'Revenus pour la période sélectionnée',
      costs: 'Coûts', due: 'Dû', fleet: 'Flotte',
      outstandingPayments: 'Paiements en attente', recentBookings: 'Réservations récentes',
      fleetStatus: 'État de la flotte', revenueVsExpenses: 'Revenus vs Dépenses',
      expenseCategories: 'Catégories de dépenses', topVehicles: 'Véhicules les plus rentables',
      capacityComparison: 'Comparaison de capacité', allMonths: 'Tous les mois',
      allMonthsAtGlance: 'Vue d\'ensemble de tous les mois', pulse: 'Bilan {{month}}',
    },
    finance: {
      title: 'Gestion financière', subtitle: 'Suivez les transactions, réquisitions et mouvements de trésorerie.',
      transactions: 'Transactions', requisitions: 'Réquisitions de caisse',
      income: 'Revenus', expenses: 'Dépenses', netProfit: 'Net', pending: 'En attente',
      searchPlaceholder: 'Rechercher par catégorie, description ou numéro CR...',
      recentActivity: 'Activité récente', cashRequisitions: 'Réquisitions de caisse',
      noTransactions: 'Aucune transaction ne correspond aux filtres actuels.',
      noRequisitions: 'Aucune réquisition ne correspond aux filtres actuels.',
      filterIncome: 'Revenu', filterExpense: 'Dépense', filterAll: 'Tout',
    },
    bookings: {
      title: 'Réservations', subtitle: 'Gérez les voyages confirmés, en attente et en cours.',
      total: 'Total', active: 'Actif', confirmed: 'Confirmé', pending: 'En attente',
      searchPlaceholder: 'Rechercher par numéro de réservation ou client...',
      sortNewest: 'Plus récent', sortOldest: 'Plus ancien', sortAmountHigh: 'Montant élevé',
      sortAmountLow: 'Montant faible', sortClientAsc: 'Client A-Z', sortClientDesc: 'Client Z-A',
      reservationsCount: 'Réservations ({{count}})',
    },
    fleet: {
      title: 'Gestion de la flotte', subtitle: 'Surveillez la disponibilité, les affectations et la maintenance.',
      total: 'Flotte totale', available: 'Disponible', onSafari: 'En safari',
      maintenance: 'Maintenance', searchPlaceholder: 'Rechercher des véhicules...',
      vehiclesCount: 'Véhicules ({{count}})',
    },
    notifications: {
      unread: 'Non lu', read: 'Lu', all: 'Tout', markAll: 'Tout marquer comme lu',
      empty: 'Aucune notification', emptyMessage: 'Vous n\'avez aucune notification.',
      error: 'Erreur lors du chargement des notifications',
    },
    more: {
      title: 'Paramètres', account: 'Paramètres du compte', changePassword: 'Changer le mot de passe',
      appInformation: 'Informations sur l\'application', quickActions: 'Actions rapides',
      themeDescription: 'Choisissez entre l\'apparence sombre et claire.',
      languageDescription: 'Changez la langue et la direction de l\'application.',
      biometricDescription: 'Utilisez Face ID, empreinte digitale ou code pour déverrouiller.',
      version: 'Version', lastSync: 'Dernière sync.', justNow: 'À l\'instant',
    },
  },
  sw: {
    app: { name: 'Jackal Adventures', subtitle: 'Muhtasari wa shughuli' },
    common: {
      dashboard: 'Dashibodi', bookings: 'Uhifadhi', fleet: 'Msafara',
      finance: 'Fedha', more: 'Zaidi', notifications: 'Arifa',
      retry: 'Jaribu tena', cancel: 'Ghairi', save: 'Hifadhi',
      logout: 'Toka', lightMode: 'Hali ya mwanga', darkMode: 'Hali ya giza',
      language: 'Lugha', biometric: 'Kuingia kwa biometric',
      enabled: 'Imewezeshwa', disabled: 'Imezimwa', settings: 'Mipangilio',
      profile: 'Wasifu', theme: 'Mandhari', currency: 'Sarafu', loading: 'Inapakia...',
      today: 'Leo', search: 'Tafuta',
      functionalSoon: 'Kitendo hiki kinapatikana katika hatua inayofuata ya mtiririko wa kazi.',
    },
    login: {
      welcome: 'Karibu tena', subtitle: 'Tumia akidi zako za Jackal Adventures kuendelea.',
      email: 'Barua pepe', password: 'Nywila', forgotPassword: 'Umesahau nywila?',
      signIn: 'Ingia', show: 'Onyesha', hide: 'Ficha',
      biometric: 'Fungua kwa {{label}}', usePassword: 'Tumia nywila badala yake',
      enableBiometricTitle: 'Wezesha kuingia kwa biometric?',
      enableBiometricMessage: 'Unaweza kufungua programu kwa haraka zaidi kwa kutumia {{label}}.',
      invalidEmail: 'Tafadhali ingiza barua pepe sahihi',
      passwordRequired: 'Nywila inahitajika', emailRequired: 'Barua pepe inahitajika',
      passwordLength: 'Nywila lazima iwe na herufi 6 au zaidi',
      footer: 'Wafanyikazi walioidhinishwa tu wanaweza kufikia programu ya simu.',
    },
    biometric: {
      title: 'Ufunguzi wa haraka', subtitle: 'Thibitisha utambulisho wako kufungua dashibodi.',
      promptMessage: 'Thibitisha ili kufikia Jackal Adventures',
      promptDescription: 'Tumia biometric uliyosajiliwa au nambari ya siri ya kifaa.',
      action: 'Thibitisha sasa', fallback: 'Tumia nywila badala yake',
      unavailable: 'Uthibitishaji wa biometric haupatikani kwenye kifaa hiki.',
    },
    dashboard: {
      refine: 'Boresha muhtasari', filters: 'Vichujio', tapToSwitch: 'Gusa kubadilisha',
      month: 'Mwezi', year: 'Mwaka', revenueFocus: 'Mapato kwa kipindi kilichochaguliwa',
      costs: 'Gharama', due: 'Inayodaiwa', fleet: 'Msafara',
      outstandingPayments: 'Malipo yanayosubiri', recentBookings: 'Uhifadhi wa hivi karibuni',
      fleetStatus: 'Hali ya msafara', revenueVsExpenses: 'Mapato dhidi ya Gharama',
      expenseCategories: 'Makundi ya gharama', topVehicles: 'Magari yenye mapato makubwa',
      capacityComparison: 'Ulinganisho wa uwezo', allMonths: 'Miezi yote',
      allMonthsAtGlance: 'Muhtasari wa miezi yote', pulse: 'Mapitio ya {{month}}',
    },
    finance: {
      title: 'Usimamizi wa fedha', subtitle: 'Fuatilia miamala, mahitaji na harakati za pesa.',
      transactions: 'Miamala', requisitions: 'Mahitaji ya fedha',
      income: 'Mapato', expenses: 'Gharama', netProfit: 'Jumla', pending: 'Inasubiri',
      searchPlaceholder: 'Tafuta kwa kategoria, maelezo au nambari ya CR...',
      recentActivity: 'Shughuli za hivi karibuni', cashRequisitions: 'Mahitaji ya pesa taslimu',
      noTransactions: 'Hakuna miamala inayolingana na vichujio vya sasa.',
      noRequisitions: 'Hakuna mahitaji yanayolingana na vichujio vya sasa.',
      filterIncome: 'Mapato', filterExpense: 'Gharama', filterAll: 'Yote',
    },
    bookings: {
      title: 'Uhifadhi', subtitle: 'Simamia safari zilizothibitishwa, zinazosubiri na zinazoendelea.',
      total: 'Jumla', active: 'Inayoendelea', confirmed: 'Imethibitishwa', pending: 'Inasubiri',
      searchPlaceholder: 'Tafuta kwa nambari ya uhifadhi au mteja...',
      sortNewest: 'Mpya zaidi', sortOldest: 'Zamani zaidi', sortAmountHigh: 'Kiasi kikubwa',
      sortAmountLow: 'Kiasi kidogo', sortClientAsc: 'Mteja A-Z', sortClientDesc: 'Mteja Z-A',
      reservationsCount: 'Uhifadhi ({{count}})',
    },
    fleet: {
      title: 'Usimamizi wa msafara', subtitle: 'Fuatilia upatikanaji, mgawanyo na matengenezo.',
      total: 'Jumla ya msafara', available: 'Inapatikana', onSafari: 'Safarini',
      maintenance: 'Matengenezo', searchPlaceholder: 'Tafuta magari...',
      vehiclesCount: 'Magari ({{count}})',
    },
    notifications: {
      unread: 'Haijasomwa', read: 'Imesomwa', all: 'Yote', markAll: 'Weka yote kuwa imesomwa',
      empty: 'Hakuna arifa', emptyMessage: 'Huna arifa kwa sasa.',
      error: 'Hitilafu wakati wa kupakia arifa',
    },
    more: {
      title: 'Mipangilio', account: 'Mipangilio ya akaunti', changePassword: 'Badilisha nywila',
      appInformation: 'Maelezo ya programu', quickActions: 'Vitendo vya haraka',
      themeDescription: 'Chagua kati ya mandhari ya giza na mwanga.',
      languageDescription: 'Badilisha lugha na mwelekeo wa programu.',
      biometricDescription: 'Tumia Face ID, alama ya kidole au nambari ya siri kufungua.',
      version: 'Toleo', lastSync: 'Usawazishaji wa mwisho', justNow: 'Sasa hivi',
    },
  },
  es: {
    app: { name: 'Jackal Adventures', subtitle: 'Resumen de operaciones' },
    common: {
      dashboard: 'Panel', bookings: 'Reservas', fleet: 'Flota',
      finance: 'Finanzas', more: 'Más', notifications: 'Notificaciones',
      retry: 'Reintentar', cancel: 'Cancelar', save: 'Guardar',
      logout: 'Cerrar sesión', lightMode: 'Modo claro', darkMode: 'Modo oscuro',
      language: 'Idioma', biometric: 'Inicio biométrico',
      enabled: 'Activado', disabled: 'Desactivado', settings: 'Configuración',
      profile: 'Perfil', theme: 'Tema', currency: 'Moneda', loading: 'Cargando...',
      today: 'Hoy', search: 'Buscar',
      functionalSoon: 'Esta acción estará disponible en el siguiente paso del flujo.',
    },
    login: {
      welcome: 'Bienvenido', subtitle: 'Usa tus credenciales de Jackal Adventures para continuar.',
      email: 'Correo electrónico', password: 'Contraseña', forgotPassword: '¿Olvidaste tu contraseña?',
      signIn: 'Iniciar sesión', show: 'Mostrar', hide: 'Ocultar',
      biometric: 'Desbloquear con {{label}}', usePassword: 'Usar contraseña',
      enableBiometricTitle: '¿Activar inicio biométrico?',
      enableBiometricMessage: 'Puedes desbloquear la app más rápido con {{label}}.',
      invalidEmail: 'Por favor, introduce un correo válido',
      passwordRequired: 'La contraseña es obligatoria', emailRequired: 'El correo es obligatorio',
      passwordLength: 'La contraseña debe tener al menos 6 caracteres',
      footer: 'Solo el personal autorizado puede acceder a la app de operaciones.',
    },
    biometric: {
      title: 'Desbloqueo rápido', subtitle: 'Verifica tu identidad para abrir el panel.',
      promptMessage: 'Autentícate para acceder a Jackal Adventures',
      promptDescription: 'Usa tu biometría registrada o el código del dispositivo.',
      action: 'Autenticar ahora', fallback: 'Usar contraseña',
      unavailable: 'La autenticación biométrica no está disponible en este dispositivo.',
    },
    dashboard: {
      refine: 'Ajustar resumen', filters: 'Filtros', tapToSwitch: 'Toca para cambiar',
      month: 'Mes', year: 'Año', revenueFocus: 'Ingresos en el período seleccionado',
      costs: 'Costos', due: 'Pendiente', fleet: 'Flota',
      outstandingPayments: 'Pagos pendientes', recentBookings: 'Reservas recientes',
      fleetStatus: 'Estado de flota', revenueVsExpenses: 'Ingresos vs Gastos',
      expenseCategories: 'Categorías de gastos', topVehicles: 'Vehículos más rentables',
      capacityComparison: 'Comparación de capacidad', allMonths: 'Todos los meses',
      allMonthsAtGlance: 'Vista general de todos los meses', pulse: 'Resumen de {{month}}',
    },
    finance: {
      title: 'Gestión financiera', subtitle: 'Controla transacciones, requisiciones y movimientos de caja.',
      transactions: 'Transacciones', requisitions: 'Requisiciones de caja',
      income: 'Ingresos', expenses: 'Gastos', netProfit: 'Neto', pending: 'Pendiente',
      searchPlaceholder: 'Buscar por categoría, descripción o número CR...',
      recentActivity: 'Actividad reciente', cashRequisitions: 'Requisiciones de caja',
      noTransactions: 'No hay transacciones que coincidan con los filtros.',
      noRequisitions: 'No hay requisiciones que coincidan con los filtros.',
      filterIncome: 'Ingreso', filterExpense: 'Gasto', filterAll: 'Todo',
    },
    bookings: {
      title: 'Reservas', subtitle: 'Gestiona viajes confirmados, pendientes y en curso.',
      total: 'Total', active: 'Activo', confirmed: 'Confirmado', pending: 'Pendiente',
      searchPlaceholder: 'Buscar por número de reserva o cliente...',
      sortNewest: 'Más reciente', sortOldest: 'Más antiguo', sortAmountHigh: 'Mayor importe',
      sortAmountLow: 'Menor importe', sortClientAsc: 'Cliente A-Z', sortClientDesc: 'Cliente Z-A',
      reservationsCount: 'Reservas ({{count}})',
    },
    fleet: {
      title: 'Gestión de flota', subtitle: 'Supervisa disponibilidad, asignaciones y mantenimiento.',
      total: 'Flota total', available: 'Disponible', onSafari: 'En safari',
      maintenance: 'Mantenimiento', searchPlaceholder: 'Buscar vehículos...',
      vehiclesCount: 'Vehículos ({{count}})',
    },
    notifications: {
      unread: 'No leído', read: 'Leído', all: 'Todo', markAll: 'Marcar todo como leído',
      empty: 'Sin notificaciones', emptyMessage: 'No tienes notificaciones en este momento.',
      error: 'Error al cargar notificaciones',
    },
    more: {
      title: 'Configuración', account: 'Configuración de cuenta', changePassword: 'Cambiar contraseña',
      appInformation: 'Información de la app', quickActions: 'Acciones rápidas',
      themeDescription: 'Elige entre apariencia oscura y clara.',
      languageDescription: 'Cambia el idioma y la dirección de la app.',
      biometricDescription: 'Usa Face ID, huella dactilar o código del dispositivo para desbloquear.',
      version: 'Versión', lastSync: 'Última sync.', justNow: 'Ahora mismo',
    },
  },
  pt: {
    app: { name: 'Jackal Adventures', subtitle: 'Resumo das operações' },
    common: {
      dashboard: 'Painel', bookings: 'Reservas', fleet: 'Frota',
      finance: 'Finanças', more: 'Mais', notifications: 'Notificações',
      retry: 'Tentar novamente', cancel: 'Cancelar', save: 'Guardar',
      logout: 'Sair', lightMode: 'Modo claro', darkMode: 'Modo escuro',
      language: 'Idioma', biometric: 'Login biométrico',
      enabled: 'Ativado', disabled: 'Desativado', settings: 'Configurações',
      profile: 'Perfil', theme: 'Tema', currency: 'Moeda', loading: 'A carregar...',
      today: 'Hoje', search: 'Pesquisar',
      functionalSoon: 'Esta ação estará disponível na próxima etapa do fluxo.',
    },
    login: {
      welcome: 'Bem-vindo', subtitle: 'Use as suas credenciais Jackal Adventures para continuar.',
      email: 'Endereço de e-mail', password: 'Senha', forgotPassword: 'Esqueceu a senha?',
      signIn: 'Entrar', show: 'Mostrar', hide: 'Esconder',
      biometric: 'Desbloquear com {{label}}', usePassword: 'Usar senha',
      enableBiometricTitle: 'Ativar login biométrico?',
      enableBiometricMessage: 'Pode desbloquear a app mais rapidamente com {{label}}.',
      invalidEmail: 'Por favor, insira um e-mail válido',
      passwordRequired: 'A senha é obrigatória', emailRequired: 'O e-mail é obrigatório',
      passwordLength: 'A senha deve ter pelo menos 6 caracteres',
      footer: 'Apenas funcionários autorizados podem aceder à app de operações.',
    },
    biometric: {
      title: 'Desbloqueio rápido', subtitle: 'Verifique a sua identidade para abrir o painel.',
      promptMessage: 'Autentique-se para aceder à Jackal Adventures',
      promptDescription: 'Use a sua biometria registada ou o código do dispositivo.',
      action: 'Autenticar agora', fallback: 'Usar senha',
      unavailable: 'A autenticação biométrica não está disponível neste dispositivo.',
    },
    dashboard: {
      refine: 'Refinar resumo', filters: 'Filtros', tapToSwitch: 'Toque para mudar',
      month: 'Mês', year: 'Ano', revenueFocus: 'Receitas no período selecionado',
      costs: 'Custos', due: 'A pagar', fleet: 'Frota',
      outstandingPayments: 'Pagamentos pendentes', recentBookings: 'Reservas recentes',
      fleetStatus: 'Estado da frota', revenueVsExpenses: 'Receitas vs Despesas',
      expenseCategories: 'Categorias de despesas', topVehicles: 'Veículos mais rentáveis',
      capacityComparison: 'Comparação de capacidade', allMonths: 'Todos os meses',
      allMonthsAtGlance: 'Visão geral de todos os meses', pulse: 'Resumo de {{month}}',
    },
    finance: {
      title: 'Gestão financeira', subtitle: 'Acompanhe transações, requisições e movimentos de caixa.',
      transactions: 'Transações', requisitions: 'Requisições de caixa',
      income: 'Receitas', expenses: 'Despesas', netProfit: 'Líquido', pending: 'Pendente',
      searchPlaceholder: 'Pesquisar por categoria, descrição ou número CR...',
      recentActivity: 'Atividade recente', cashRequisitions: 'Requisições de caixa',
      noTransactions: 'Nenhuma transação corresponde aos filtros atuais.',
      noRequisitions: 'Nenhuma requisição corresponde aos filtros atuais.',
      filterIncome: 'Receita', filterExpense: 'Despesa', filterAll: 'Tudo',
    },
    bookings: {
      title: 'Reservas', subtitle: 'Gira viagens confirmadas, pendentes e em curso.',
      total: 'Total', active: 'Ativo', confirmed: 'Confirmado', pending: 'Pendente',
      searchPlaceholder: 'Pesquisar por número de reserva ou cliente...',
      sortNewest: 'Mais recente', sortOldest: 'Mais antigo', sortAmountHigh: 'Valor alto',
      sortAmountLow: 'Valor baixo', sortClientAsc: 'Cliente A-Z', sortClientDesc: 'Cliente Z-A',
      reservationsCount: 'Reservas ({{count}})',
    },
    fleet: {
      title: 'Gestão de frota', subtitle: 'Monitorize disponibilidade, atribuições e manutenção.',
      total: 'Frota total', available: 'Disponível', onSafari: 'Em safari',
      maintenance: 'Manutenção', searchPlaceholder: 'Pesquisar veículos...',
      vehiclesCount: 'Veículos ({{count}})',
    },
    notifications: {
      unread: 'Não lido', read: 'Lido', all: 'Tudo', markAll: 'Marcar tudo como lido',
      empty: 'Sem notificações', emptyMessage: 'Não tem notificações neste momento.',
      error: 'Erro ao carregar notificações',
    },
    more: {
      title: 'Configurações', account: 'Configurações de conta', changePassword: 'Alterar senha',
      appInformation: 'Informações da app', quickActions: 'Ações rápidas',
      themeDescription: 'Escolha entre aparência escura e clara.',
      languageDescription: 'Mude o idioma e a direção da app.',
      biometricDescription: 'Use Face ID, impressão digital ou código do dispositivo para desbloquear.',
      version: 'Versão', lastSync: 'Última sync.', justNow: 'Agora mesmo',
    },
  },
  en: {
    app: {
      name: 'Jackal Adventures',
      subtitle: 'Operations snapshot',
    },
    common: {
      dashboard: 'Dashboard',
      bookings: 'Bookings',
      fleet: 'Fleet',
      finance: 'Finance',
      more: 'More',
      notifications: 'Notifications',
      retry: 'Retry',
      cancel: 'Cancel',
      save: 'Save',
      logout: 'Sign Out',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
      language: 'Language',
      biometric: 'Biometric Login',
      enabled: 'Enabled',
      disabled: 'Disabled',
      settings: 'Settings',
      profile: 'Profile',
      theme: 'Theme',
      currency: 'Currency',
      loading: 'Loading...',
      today: 'Today',
      search: 'Search',
      functionalSoon: 'This action is available in the next step of the workflow.',
    },
    login: {
      welcome: 'Welcome back',
      subtitle: 'Use your Jackal Adventures credentials to continue.',
      email: 'Email Address',
      password: 'Password',
      forgotPassword: 'Forgot Password?',
      signIn: 'Sign In',
      show: 'Show',
      hide: 'Hide',
      biometric: 'Unlock with {{label}}',
      usePassword: 'Use password instead',
      enableBiometricTitle: 'Enable biometric login?',
      enableBiometricMessage: 'You can unlock the app faster with {{label}} next time.',
      invalidEmail: 'Please enter a valid email address',
      passwordRequired: 'Password is required',
      emailRequired: 'Email is required',
      passwordLength: 'Password must be at least 6 characters',
      footer: 'Only authorized staff can access the mobile operations app.',
    },
    biometric: {
      title: 'Quick unlock',
      subtitle: 'Verify your identity to open the dashboard.',
      promptMessage: 'Authenticate to access Jackal Adventures',
      promptDescription: 'Use your enrolled biometrics or device passcode.',
      action: 'Authenticate now',
      fallback: 'Use password instead',
      unavailable: 'Biometric authentication is not available on this device.',
    },
    dashboard: {
      refine: 'Refine the snapshot',
      filters: 'Filters',
      tapToSwitch: 'Tap to switch',
      month: 'Month',
      year: 'Year',
      revenueFocus: 'Revenue in focus for the selected period',
      costs: 'Costs',
      due: 'Due',
      fleet: 'Fleet',
      outstandingPayments: 'Outstanding Payments',
      recentBookings: 'Recent Bookings',
      fleetStatus: 'Fleet Status',
      revenueVsExpenses: 'Revenue vs Expenses',
      expenseCategories: 'Expense Categories',
      topVehicles: 'Top Revenue Vehicles',
      capacityComparison: 'Capacity Comparison',
      allMonths: 'All Months',
      allMonthsAtGlance: 'All months at a glance',
      pulse: '{{month}} pulse',
    },
    finance: {
      title: 'Financial Management',
      subtitle: 'Track transactions, requisitions, and cash movement.',
      transactions: 'Transactions',
      requisitions: 'Cash Requisitions',
      income: 'Income',
      expenses: 'Expenses',
      netProfit: 'Net',
      pending: 'Pending',
      searchPlaceholder: 'Search category, description, or CR number...',
      recentActivity: 'Recent activity',
      cashRequisitions: 'Cash Requisitions',
      noTransactions: 'No transactions match the current filters.',
      noRequisitions: 'No cash requisitions match the current filters.',
      filterIncome: 'Income',
      filterExpense: 'Expense',
      filterAll: 'All',
    },
    bookings: {
      title: 'Reservations',
      subtitle: 'Manage confirmed, pending, and in-progress trips.',
      total: 'Total',
      active: 'Active',
      confirmed: 'Confirmed',
      pending: 'Pending',
      searchPlaceholder: 'Search by booking number or client...',
      sortNewest: 'Newest',
      sortOldest: 'Oldest',
      sortAmountHigh: 'Amount high',
      sortAmountLow: 'Amount low',
      sortClientAsc: 'Client A-Z',
      sortClientDesc: 'Client Z-A',
      reservationsCount: 'Reservations ({{count}})',
    },
    fleet: {
      title: 'Fleet Management',
      subtitle: 'Monitor availability, assignments, and maintenance.',
      total: 'Total Fleet',
      available: 'Available',
      onSafari: 'On Safari',
      maintenance: 'Maintenance',
      searchPlaceholder: 'Search vehicles...',
      vehiclesCount: 'Vehicles ({{count}})',
    },
    notifications: {
      unread: 'Unread',
      read: 'Read',
      all: 'All',
      markAll: 'Mark all as read',
      empty: 'No notifications',
      emptyMessage: 'You have no notifications at this time.',
      error: 'Error loading notifications',
    },
    more: {
      title: 'Settings',
      account: 'Account Settings',
      changePassword: 'Change Password',
      appInformation: 'App Information',
      quickActions: 'Quick Actions',
      themeDescription: 'Choose between dark and light appearance.',
      languageDescription: 'Switch the app language and layout direction.',
      biometricDescription: 'Use Face ID, fingerprint, or device passcode to unlock the app.',
      version: 'Version',
      lastSync: 'Last Sync',
      justNow: 'Just now',
    },
  },
  ar: {
    app: {
      name: 'جاكال أدفنتشرز',
      subtitle: 'ملخص العمليات',
    },
    common: {
      dashboard: 'لوحة التحكم',
      bookings: 'الحجوزات',
      fleet: 'الأسطول',
      finance: 'المالية',
      more: 'المزيد',
      notifications: 'الإشعارات',
      retry: 'إعادة المحاولة',
      cancel: 'إلغاء',
      save: 'حفظ',
      logout: 'تسجيل الخروج',
      lightMode: 'الوضع الفاتح',
      darkMode: 'الوضع الداكن',
      language: 'اللغة',
      biometric: 'الدخول البيومتري',
      enabled: 'مفعل',
      disabled: 'غير مفعل',
      settings: 'الإعدادات',
      profile: 'الملف الشخصي',
      theme: 'السمة',
      currency: 'العملة',
      loading: 'جاري التحميل...',
      today: 'اليوم',
      search: 'بحث',
      functionalSoon: 'هذه العملية متاحة في الخطوة التالية من سير العمل.',
    },
    login: {
      welcome: 'مرحباً بعودتك',
      subtitle: 'استخدم بيانات جاكال أدفنتشرز للمتابعة.',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      forgotPassword: 'هل نسيت كلمة المرور؟',
      signIn: 'تسجيل الدخول',
      show: 'إظهار',
      hide: 'إخفاء',
      biometric: 'الدخول باستخدام {{label}}',
      usePassword: 'استخدام كلمة المرور',
      enableBiometricTitle: 'تفعيل الدخول البيومتري؟',
      enableBiometricMessage: 'يمكنك فتح التطبيق بسرعة باستخدام {{label}} في المرة القادمة.',
      invalidEmail: 'يرجى إدخال بريد إلكتروني صحيح',
      passwordRequired: 'كلمة المرور مطلوبة',
      emailRequired: 'البريد الإلكتروني مطلوب',
      passwordLength: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل',
      footer: 'يمكن للموظفين المصرح لهم فقط استخدام تطبيق العمليات المحمول.',
    },
    biometric: {
      title: 'فتح سريع',
      subtitle: 'تحقق من هويتك لفتح لوحة التحكم.',
      promptMessage: 'قم بالمصادقة للوصول إلى جاكال أدفنتشرز',
      promptDescription: 'استخدم القياسات الحيوية المسجلة أو رمز الجهاز.',
      action: 'تحقق الآن',
      fallback: 'استخدام كلمة المرور',
      unavailable: 'المصادقة البيومترية غير متاحة على هذا الجهاز.',
    },
    dashboard: {
      refine: 'خصص الملخص',
      filters: 'الفلاتر',
      tapToSwitch: 'اضغط للتبديل',
      month: 'الشهر',
      year: 'السنة',
      revenueFocus: 'الإيرادات ضمن الفترة المحددة',
      costs: 'التكاليف',
      due: 'المستحق',
      fleet: 'الأسطول',
      outstandingPayments: 'المدفوعات المستحقة',
      recentBookings: 'أحدث الحجوزات',
      fleetStatus: 'حالة الأسطول',
      revenueVsExpenses: 'الإيرادات مقابل المصروفات',
      expenseCategories: 'فئات المصروفات',
      topVehicles: 'أعلى المركبات دخلاً',
      capacityComparison: 'مقارنة السعة',
      allMonths: 'كل الأشهر',
      allMonthsAtGlance: 'نظرة على كل الأشهر',
      pulse: 'نبض {{month}}',
    },
    finance: {
      title: 'الإدارة المالية',
      subtitle: 'تابع المعاملات وطلبات الصرف وحركة النقد.',
      transactions: 'المعاملات',
      requisitions: 'طلبات الصرف',
      income: 'الإيرادات',
      expenses: 'المصروفات',
      netProfit: 'الصافي',
      pending: 'قيد الانتظار',
      searchPlaceholder: 'ابحث في الفئة أو الوصف أو رقم الطلب...',
      recentActivity: 'آخر النشاطات',
      cashRequisitions: 'طلبات الصرف النقدي',
      noTransactions: 'لا توجد معاملات تطابق الفلاتر الحالية.',
      noRequisitions: 'لا توجد طلبات صرف تطابق الفلاتر الحالية.',
      filterIncome: 'إيراد',
      filterExpense: 'مصروف',
      filterAll: 'الكل',
    },
    bookings: {
      title: 'الحجوزات',
      subtitle: 'إدارة الرحلات المؤكدة والقيد الجاري والمعلقة.',
      total: 'الإجمالي',
      active: 'نشط',
      confirmed: 'مؤكد',
      pending: 'معلق',
      searchPlaceholder: 'ابحث برقم الحجز أو العميل...',
      sortNewest: 'الأحدث',
      sortOldest: 'الأقدم',
      sortAmountHigh: 'المبلغ الأعلى',
      sortAmountLow: 'المبلغ الأقل',
      sortClientAsc: 'العميل أ-ي',
      sortClientDesc: 'العميل ي-أ',
      reservationsCount: 'الحجوزات ({{count}})',
    },
    fleet: {
      title: 'إدارة الأسطول',
      subtitle: 'راقب التوفر والتكليفات والصيانة.',
      total: 'إجمالي الأسطول',
      available: 'متاح',
      onSafari: 'في رحلة',
      maintenance: 'صيانة',
      searchPlaceholder: 'ابحث عن المركبات...',
      vehiclesCount: 'المركبات ({{count}})',
    },
    notifications: {
      unread: 'غير مقروء',
      read: 'مقروء',
      all: 'الكل',
      markAll: 'تحديد الكل كمقروء',
      empty: 'لا توجد إشعارات',
      emptyMessage: 'لا توجد لديك إشعارات حالياً.',
      error: 'تعذر تحميل الإشعارات',
    },
    more: {
      title: 'الإعدادات',
      account: 'إعدادات الحساب',
      changePassword: 'تغيير كلمة المرور',
      appInformation: 'معلومات التطبيق',
      quickActions: 'إجراءات سريعة',
      themeDescription: 'اختر بين الوضع الداكن والفاتح.',
      languageDescription: 'بدّل لغة التطبيق واتجاه الواجهة.',
      biometricDescription: 'استخدم بصمة الوجه أو الإصبع أو رمز الجهاز لفتح التطبيق.',
      version: 'الإصدار',
      lastSync: 'آخر مزامنة',
      justNow: 'الآن',
    },
  },
};

interface AppPreferencesContextValue {
  ready: boolean;
  theme: AppTheme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
  language: AppLanguage;
  isRTL: boolean;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  biometricEnabled: boolean;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  biometricAvailable: boolean;
  biometricLabel: string;
  authenticateWithBiometrics: () => Promise<boolean>;
  notificationPrefs: NotificationPrefs;
  setNotificationPrefs: (prefs: NotificationPrefs) => Promise<void>;
  updateNotificationPref: (key: keyof NotificationPrefs, value: boolean) => Promise<void>;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | undefined>(undefined);

function getDeviceLanguage(): AppLanguage {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  if (locale.startsWith('ar')) return 'ar';
  if (locale.startsWith('fr')) return 'fr';
  if (locale.startsWith('sw')) return 'sw';
  if (locale.startsWith('es')) return 'es';
  if (locale.startsWith('pt')) return 'pt';
  return 'en';
}

function getTranslationValue(language: AppLanguage, key: string): string {
  const segments = key.split('.');
  let current: TranslationLeaf | TranslationTree | undefined = translations[language];

  for (const segment of segments) {
    if (!current || typeof current === 'string') {
      return key;
    }
    current = current[segment];
  }

  return typeof current === 'string' ? current : key;
}

function formatMessage(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((message, [paramKey, value]) => {
    return message.replaceAll(`{{${paramKey}}}`, String(value));
  }, template);
}

async function readStoredPreference<T>(key: string): Promise<T | null> {
  const rawValue = await AsyncStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [language, setLanguageState] = useState<AppLanguage>(getDeviceLanguage());
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const [notificationPrefs, setNotificationPrefsState] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [storedTheme, storedLanguage, storedBiometrics, storedNotifPrefs] = await Promise.all([
        readStoredPreference<ThemeMode>(STORAGE_KEYS.theme),
        readStoredPreference<AppLanguage>(STORAGE_KEYS.language),
        readStoredPreference<boolean>(STORAGE_KEYS.biometrics),
        readStoredPreference<NotificationPrefs>(STORAGE_KEYS.notificationPrefs),
      ]);

      if (!mounted) {
        return;
      }

      if (storedTheme) {
        setThemeModeState(storedTheme);
      }
      if (storedLanguage) {
        setLanguageState(storedLanguage);
      }
      if (typeof storedBiometrics === 'boolean') {
        setBiometricEnabledState(storedBiometrics);
      }
      if (storedNotifPrefs) {
        setNotificationPrefsState({ ...DEFAULT_NOTIFICATION_PREFS, ...storedNotifPrefs });
      }

      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);

      if (!mounted) {
        return;
      }

      setBiometricAvailable(hasHardware && isEnrolled);

      if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricLabel(Platform.OS === 'ios' ? 'Face ID' : 'Face Unlock');
      } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricLabel('Fingerprint');
      } else {
        setBiometricLabel('Biometrics');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(mode));
  }, []);

  const toggleTheme = useCallback(async () => {
    await setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
  }, [setThemeMode, themeMode]);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    await AsyncStorage.setItem(STORAGE_KEYS.language, JSON.stringify(nextLanguage));
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    setBiometricEnabledState(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.biometrics, JSON.stringify(enabled));
  }, []);

  const setNotificationPrefs = useCallback(async (prefs: NotificationPrefs) => {
    setNotificationPrefsState(prefs);
    await AsyncStorage.setItem(STORAGE_KEYS.notificationPrefs, JSON.stringify(prefs));
  }, []);

  const updateNotificationPref = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    setNotificationPrefsState((prev) => {
      const updated = { ...prev, [key]: value };
      AsyncStorage.setItem(STORAGE_KEYS.notificationPrefs, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return formatMessage(getTranslationValue(language, key), params);
    },
    [language]
  );

  const authenticateWithBiometrics = useCallback(async () => {
    if (!biometricAvailable) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('biometric.promptMessage'),
      promptDescription: t('biometric.promptDescription'),
      fallbackLabel: t('login.usePassword'),
      cancelLabel: t('common.cancel'),
      disableDeviceFallback: false,
    });

    return result.success;
  }, [biometricAvailable, t]);

  const value = useMemo<AppPreferencesContextValue>(() => {
    return {
      ready,
      theme: themes[themeMode] ?? darkTheme,
      themeMode,
      setThemeMode,
      toggleTheme,
      language,
      isRTL: language === 'ar',
      setLanguage,
      t,
      biometricEnabled,
      setBiometricEnabled,
      biometricAvailable,
      biometricLabel,
      authenticateWithBiometrics,
      notificationPrefs,
      setNotificationPrefs,
      updateNotificationPref,
    };
  }, [
    authenticateWithBiometrics,
    biometricAvailable,
    biometricEnabled,
    biometricLabel,
    language,
    notificationPrefs,
    ready,
    setBiometricEnabled,
    setLanguage,
    setNotificationPrefs,
    setThemeMode,
    t,
    themeMode,
    toggleTheme,
    updateNotificationPref,
  ]);

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences(): AppPreferencesContextValue {
  const context = useContext(AppPreferencesContext);

  if (!context) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }

  return context;
}
