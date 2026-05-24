// Statistical Data Analysis for FIFA PRO - Using TrainCDN Dictionary
class StatisticalDataAnalyzer {
  constructor() {
    this.dictionaryUrl = 'https://v3.traincdn.com/genfiles/web-app-v2/dictionary2/v3_statistic_game/fr/dictionary_ef638ac3d5aca0a308851c38a24bdd7c.json';
    this.statisticalDictionary = null;
    this.footballRelevantStats = new Set();
    this.basketballRelevantStats = new Set();
    this.tennisRelevantStats = new Set();
    this.rugbyRelevantStats = new Set();
    this.americanFootballRelevantStats = new Set();
    this.handballRelevantStats = new Set();
    this.dartsRelevantStats = new Set();
    this.baseballRelevantStats = new Set();
    this.hockeyRelevantStats = new Set();
    this.volleyballRelevantStats = new Set();
    
    this.init();
  }

  async init() {
    console.log('📊 Initializing Statistical Data Analyzer...');
    await this.loadDictionary();
    this.categorizeStatistics();
    this.analyzeRelevance();
  }

  async loadDictionary() {
    try {
      const response = await fetch(this.dictionaryUrl);
      this.statisticalDictionary = await response.json();
      console.log('✅ Statistical dictionary loaded successfully');
      console.log(`📈 Total statistics available: ${Object.keys(this.statisticalDictionary).length}`);
    } catch (error) {
      console.error('❌ Failed to load statistical dictionary:', error);
      this.statisticalDictionary = this.getFallbackDictionary();
    }
  }

  categorizeStatistics() {
    // Football/Soccer relevant statistics
    this.footballRelevantStats = new Set([
      'statistic_game_11', // Passes décisives
      'statistic_game_12', // Dégagements
      'statistic_game_13', // Passes au pied
      'statistic_game_14', // Dans le demi-cercle des 50m
      'statistic_game_15', // Efficacité des passes au pied, %
      'statistic_game_16', // Erreurs
      'statistic_game_17', // Tirs
      'statistic_game_18', // Pénalités
      'statistic_game_19', // Buts en supériorité numérique
      'statistic_game_20', // Possession de balle, %
      'statistic_game_25', // Nombre max. de buts marqués d'affilée
      'statistic_game_26', // Cartons jaunes
      'statistic_game_27', // Disqualifications
      'statistic_game_28', // Buts dans les 10 dernières minutes
      'statistic_game_29', // % de possession de balle
      'statistic_game_45', // Attaques
      'statistic_game_46', // Attaques, %
      'statistic_game_47', // Arrêts
      'statistic_game_58', // Attaques dangereuses
      'statistic_game_59', // Tirs cadrés
      'statistic_game_60', // Tirs non cadrés
      'statistic_game_68', // Tirs cadrés
      'statistic_game_69', // Tirs de pénalité
      'statistic_game_70', // Corners
      'statistic_game_71', // Cartons rouges
      'statistic_game_72', // Penalty
      'statistic_game_73', // Verges au sol
      'statistic_game_74', // Tentatives de rush
      'statistic_game_75', // Passes complétées
      'statistic_game_76', // Tentatives de passe
      'statistic_game_93', // xG
      'statistic_game_94', // Passes clés
      'statistic_game_95', // Précision des passes %
      'statistic_game_96', // Centres
      'statistic_game_97', // Précision des centres %
      'statistic_game_98'  // Breaks
    ]);

    // Basketball relevant statistics
    this.basketballRelevantStats = new Set([
      'statistic_game_47', // Arrêts
      'statistic_game_48', // paniers à 3 pts
      'statistic_game_49', // paniers à 2 pts
      'statistic_game_50', // Lancers francs
      'statistic_game_51', // Lancers francs marqués, %
      'statistic_game_52', // Temps morts restant
      'statistic_game_53', // Fautes
      'statistic_game_54', // Possession au cours des 10 dernières minutes, %
      'statistic_game_77', // Périodes
      'statistic_game_78', // Total de yards
      'statistic_game_79', // Moyenne de yards par période
      'statistic_game_85', // Nombre maximum de courses par manche
      'statistic_game_91', // Exclusions de 20 secondes
      'statistic_game_92'  // Remplaçants
    ]);

    // Tennis relevant statistics
    this.tennisRelevantStats = new Set([
      'statistic_game_1', // Ace
      'statistic_game_2', // % de points gagnés sur premier service
      'statistic_game_3', // Pourcentage de balle de break
      'statistic_game_4', // Double fautes
      'statistic_game_5', // Erreurs
      'statistic_game_6', // Nombre de services
      'statistic_game_7', // % de points gagnés sur second service
      'statistic_game_8', // Pourcentage de réussite au premier service
      'statistic_game_9', // Nombre max. de jeux gagnés d'affilée
      'statistic_game_10', // Nombre max. de points gagnés d'affilée
      'statistic_game_30', // Points sur son service
      'statistic_game_31', // Points sur le service adverse
      'statistic_game_32', // Points gagnés sur son service, %
      'statistic_game_33', // Points gagnés sur le service adverse, %
      'statistic_game_34', // Temps morts
      'statistic_game_35', // Points gagnés
      'statistic_game_61', // Balles de break
      'statistic_game_90'  // Fautes au service
    ]);

    // Rugby relevant statistics
    this.rugbyRelevantStats = new Set([
      'statistic_game_11', // Passes décisives
      'statistic_game_12', // Dégagements
      'statistic_game_13', // Passes au pied
      'statistic_game_14', // Dans le demi-cercle des 50m
      'statistic_game_15', // Efficacité des passes au pied, %
      'statistic_game_16', // Erreurs
      'statistic_game_18', // Pénalités
      'statistic_game_19', // Buts en supériorité numérique
      'statistic_game_20', // Possession de balle, %
      'statistic_game_25', // Nombre max. de buts marqués d'affilée
      'statistic_game_26', // Cartons jaunes
      'statistic_game_27', // Disqualifications
      'statistic_game_28', // Buts dans les 10 dernières minutes
      'statistic_game_29', // % de possession de balle
      'statistic_game_55', // Essais
      'statistic_game_56', // Temps passé dans les 22 mètres adverses
      'statistic_game_57', // Temps passé dans les 22 mètres adverses
      'statistic_game_58', // Attaques dangereuses
      'statistic_game_65', // Engagements gagnés
      'statistic_game_66', // Dégagements interdits
      'statistic_game_67', // Hors-jeu
      'statistic_game_69', // Tirs de pénalité
      'statistic_game_71', // Cartons rouges
      'statistic_game_72', // Penalty
      'statistic_game_73'  // Verges au sol
    ]);

    // American Football relevant statistics
    this.americanFootballRelevantStats = new Set([
      'statistic_game_74', // Tentatives de rush
      'statistic_game_75', // Passes complétées
      'statistic_game_76', // Tentatives de passe
      'statistic_game_77', // Périodes
      'statistic_game_78', // Total de yards
      'statistic_game_79', // Moyenne de yards par période
      'statistic_game_80', // Efficacité dans le 3e down
      'statistic_game_81', // Efficacité dans la zone rouge
      'statistic_game_82', // Passes complétées, yards
      'statistic_game_85'  // Nombre maximum de courses par manche
    ]);

    // Handball relevant statistics
    this.handballRelevantStats = new Set([
      'statistic_game_21', // Jets de 7 mètres
      'statistic_game_22', // Exclusions de 2 minutes
      'statistic_game_23', // Lancers francs
      'statistic_game_24', // Plus gros écart au score
      'statistic_game_25', // Nombre max. de buts marqués d'affilée
      'statistic_game_26', // Cartons jaunes
      'statistic_game_27', // Disqualifications
      'statistic_game_28', // Buts dans les 10 dernières minutes
      'statistic_game_29', // % de possession de balle
      'statistic_game_45', // Attaques
      'statistic_game_46', // Attaques, %
      'statistic_game_47', // Arrêts
      'statistic_game_58', // Attaques dangereuses
      'statistic_game_59', // Tirs cadrés
      'statistic_game_60', // Tirs non cadrés
      'statistic_game_68', // Tirs cadrés
      'statistic_game_71', // Cartons rouges
      'statistic_game_72', // Penalty
      'statistic_game_91', // Exclusions de 20 secondes
      'statistic_game_92'  // Remplaçants
    ]);

    // Darts relevant statistics
    this.dartsRelevantStats = new Set([
      'statistic_game_36', // Moyenne à 3 fléchettes
      'statistic_game_37', // 180
      'statistic_game_38', // Manches gagnées sur le lancer adverse
      'statistic_game_39', // Checkout le plus élevé
      'statistic_game_40', // Checkouts rouges, %
      'statistic_game_41', // Checkouts verts, %
      'statistic_game_42', // + de 100 lancers
      'statistic_game_43', // + de 140 lancers
      'statistic_game_44'  // + de 170 lancers
    ]);

    // Baseball relevant statistics
    this.baseballRelevantStats = new Set([
      'statistic_game_85', // Nombre maximum de courses par manche
      'statistic_game_86', // Lancers
      'statistic_game_87', // Prises
      'statistic_game_88'  // Balles
    ]);

    // Hockey relevant statistics
    this.hockeyRelevantStats = new Set([
      'statistic_game_18', // Pénalités
      'statistic_game_62', // Pénalités de 2 minutes
      'statistic_game_63', // Pénalités de 5 minutes
      'statistic_game_64', // Pénalités de 10 minutes
      'statistic_game_65', // Engagements gagnés
      'statistic_game_71', // Cartons rouges
      'statistic_game_72', // Penalty
      'statistic_game_92'  // Remplaçants
    ]);

    // Volleyball relevant statistics
    this.volleyballRelevantStats = new Set([
      'statistic_game_45', // Attaques
      'statistic_game_46', // Attaques, %
      'statistic_game_47', // Arrêts
      'statistic_game_58', // Attaques dangereuses
      'statistic_game_59', // Tirs cadrés
      'statistic_game_60', // Tirs non cadrés
      'statistic_game_68', // Tirs cadrés
      'statistic_game_92'  // Remplaçants
    ]);
  }

  analyzeRelevance() {
    console.log('🔍 Analyzing statistical relevance for FIFA PRO...');
    
    const analysis = {
      totalStats: Object.keys(this.statisticalDictionary).length,
      footballStats: this.footballRelevantStats.size,
      basketballStats: this.basketballRelevantStats.size,
      tennisStats: this.tennisRelevantStats.size,
      rugbyStats: this.rugbyRelevantStats.size,
      americanFootballStats: this.americanFootballRelevantStats.size,
      handballStats: this.handballRelevantStats.size,
      dartsStats: this.dartsRelevantStats.size,
      baseballStats: this.baseballRelevantStats.size,
      hockeyStats: this.hockeyRelevantStats.size,
      volleyballStats: this.volleyballRelevantStats.size
    };

    console.log('📊 Statistical Analysis Results:');
    console.table(analysis);

    return analysis;
  }

  getFootballStatistics() {
    const footballStats = {};
    this.footballRelevantStats.forEach(statId => {
      if (this.statisticalDictionary[statId]) {
        footballStats[statId] = this.statisticalDictionary[statId];
      }
    });
    return footballStats;
  }

  getStatisticsBySport(sport) {
    const sportMap = {
      'football': this.footballRelevantStats,
      'basketball': this.basketballRelevantStats,
      'tennis': this.tennisRelevantStats,
      'rugby': this.rugbyRelevantStats,
      'american-football': this.americanFootballRelevantStats,
      'handball': this.handballRelevantStats,
      'darts': this.dartsRelevantStats,
      'baseball': this.baseballRelevantStats,
      'hockey': this.hockeyRelevantStats,
      'volleyball': this.volleyballRelevantStats
    };

    const relevantStats = sportMap[sport];
    if (!relevantStats) return {};

    const stats = {};
    relevantStats.forEach(statId => {
      if (this.statisticalDictionary[statId]) {
        stats[statId] = this.statisticalDictionary[statId];
      }
    });

    return stats;
  }

  generateCouponAnalysis(matchData) {
    if (!matchData || !matchData.sport) {
      return { error: 'Invalid match data or sport not specified' };
    }

    const sport = matchData.sport.toLowerCase();
    const relevantStats = this.getStatisticsBySport(sport);
    
    const analysis = {
      sport: sport,
      availableStats: Object.keys(relevantStats).length,
      keyMetrics: this.extractKeyMetrics(relevantStats, matchData),
      bettingInsights: this.generateBettingInsights(relevantStats, matchData),
      statisticalAdvantage: this.calculateStatisticalAdvantage(relevantStats, matchData)
    };

    return analysis;
  }

  extractKeyMetrics(relevantStats, matchData) {
    const keyMetrics = [];
    
    // Extract most relevant statistics for betting
    const priorityStats = [
      'statistic_game_93', // xG (Expected Goals)
      'statistic_game_20', // Possession de balle, %
      'statistic_game_59', // Tirs cadrés
      'statistic_game_60', // Tirs non cadrés
      'statistic_game_11', // Passes décisives
      'statistic_game_26', // Cartons jaunes
      'statistic_game_71'  // Cartons rouges
    ];

    priorityStats.forEach(statId => {
      if (relevantStats[statId]) {
        keyMetrics.push({
          id: statId,
          name: relevantStats[statId],
          value: matchData[statId] || 'N/A',
          importance: this.calculateImportance(statId)
        });
      }
    });

    return keyMetrics.sort((a, b) => b.importance - a.importance);
  }

  generateBettingInsights(relevantStats, matchData) {
    const insights = [];
    
    // Generate insights based on statistical data
    if (matchData['statistic_game_93']) { // xG
      const xG = parseFloat(matchData['statistic_game_93']);
      if (xG > 2.5) {
        insights.push({
          type: 'over_goals',
          confidence: 'high',
          reasoning: `xG élevé (${xG}) suggère potentiel de plus de 2.5 buts`,
          odds: '1.8-2.2'
        });
      }
    }

    if (matchData['statistic_game_20']) { // Possession
      const possession = parseFloat(matchData['statistic_game_20']);
      if (possession > 60) {
        insights.push({
          type: 'dominance',
          confidence: 'medium',
          reasoning: `Possession élevée (${possession}%) indique contrôle du jeu`,
          odds: '1.6-1.9'
        });
      }
    }

    if (matchData['statistic_game_59'] && matchData['statistic_game_60']) { // Tirs
      const shotsOnTarget = parseInt(matchData['statistic_game_59']);
      const shotsOffTarget = parseInt(matchData['statistic_game_60']);
      const totalShots = shotsOnTarget + shotsOffTarget;
      const accuracy = totalShots > 0 ? (shotsOnTarget / totalShots) * 100 : 0;
      
      if (accuracy > 50) {
        insights.push({
          type: 'shooting_accuracy',
          confidence: 'medium',
          reasoning: `Précision de tir élevée (${accuracy.toFixed(1)}%)`,
          odds: '1.7-2.0'
        });
      }
    }

    return insights;
  }

  calculateStatisticalAdvantage(relevantStats, matchData) {
    let advantageScore = 0;
    let factors = [];

    // Calculate advantage based on various factors
    if (matchData['statistic_game_93']) { // xG
      const xG = parseFloat(matchData['statistic_game_93']);
      advantageScore += xG * 10;
      factors.push(`xG: ${xG}`);
    }

    if (matchData['statistic_game_20']) { // Possession
      const possession = parseFloat(matchData['statistic_game_20']);
      advantageScore += (possession - 50) * 0.5;
      factors.push(`Possession: ${possession}%`);
    }

    if (matchData['statistic_game_59']) { // Tirs cadrés
      const shotsOnTarget = parseInt(matchData['statistic_game_59']);
      advantageScore += shotsOnTarget * 2;
      factors.push(`Tirs cadrés: ${shotsOnTarget}`);
    }

    return {
      score: Math.round(advantageScore),
      factors: factors,
      recommendation: this.getRecommendation(advantageScore)
    };
  }

  calculateImportance(statId) {
    // Define importance weights for different statistics
    const importanceMap = {
      'statistic_game_93': 10, // xG - Very important
      'statistic_game_20': 8,  // Possession - High importance
      'statistic_game_59': 7,  // Tirs cadrés - High importance
      'statistic_game_11': 6,  // Passes décisives - Medium-high importance
      'statistic_game_26': 5,  // Cartons jaunes - Medium importance
      'statistic_game_71': 4,  // Cartons rouges - Medium importance
      'statistic_game_60': 4,  // Tirs non cadrés - Medium importance
      'statistic_game_94': 6,  // Passes clés - Medium-high importance
      'statistic_game_95': 5,  // Précision des passes - Medium importance
      'statistic_game_70': 3   // Corners - Low-medium importance
    };

    return importanceMap[statId] || 1;
  }

  getRecommendation(score) {
    if (score > 80) return 'Strong Buy';
    if (score > 60) return 'Buy';
    if (score > 40) return 'Hold';
    if (score > 20) return 'Sell';
    return 'Strong Sell';
  }

  getFallbackDictionary() {
    // Fallback dictionary in case the API fails
    return {
      'statistic_game_1': 'Ace',
      'statistic_game_2': '% de points gagnés sur premier service',
      'statistic_game_3': 'Pourcentage de balle de break',
      'statistic_game_4': 'Double fautes',
      'statistic_game_5': 'Erreurs',
      'statistic_game_6': 'Nombre de services',
      'statistic_game_7': '% de points gagnés sur second service',
      'statistic_game_8': 'Pourcentage de réussite au premier service',
      'statistic_game_9': 'Nombre max. de jeux gagnés d\'affilée',
      'statistic_game_10': 'Nombre max. de points gagnés d\'affilée',
      'statistic_game_11': 'Passes décisives',
      'statistic_game_12': 'Dégagements',
      'statistic_game_13': 'Passes au pied',
      'statistic_game_14': 'Dans le demi-cercle des 50 m',
      'statistic_game_15': 'Efficacité des passes au pied, %',
      'statistic_game_16': 'Erreurs',
      'statistic_game_17': 'Tirs',
      'statistic_game_18': 'Pénalités',
      'statistic_game_19': 'Buts en supériorité numérique',
      'statistic_game_20': 'Possession de balle, %',
      'statistic_game_21': 'Jets de 7 mètres',
      'statistic_game_22': 'Exclusions de 2 minutes',
      'statistic_game_23': 'Lancers francs',
      'statistic_game_24': 'Plus gros écart au score',
      'statistic_game_25': 'Nombre max. de buts marqués d\'affilée',
      'statistic_game_26': 'Cartons jaunes',
      'statistic_game_27': 'Disqualifications',
      'statistic_game_28': 'Buts dans les 10 dernières minutes',
      'statistic_game_29': '% de possession de balle',
      'statistic_game_30': 'Points sur son service',
      'statistic_game_31': 'Points sur le service adverse',
      'statistic_game_32': 'Points gagnés sur son service, %',
      'statistic_game_33': 'Points gagnés sur le service adverse, %',
      'statistic_game_34': 'Temps morts',
      'statistic_game_35': 'Points gagnés',
      'statistic_game_36': 'Moyenne à 3 fléchettes',
      'statistic_game_37': '180',
      'statistic_game_38': 'Manches gagnées sur le lancer adverse',
      'statistic_game_39': 'Checkout le plus élevé',
      'statistic_game_40': 'Checkouts rouges, %',
      'statistic_game_41': 'Checkouts verts, %',
      'statistic_game_42': '+ de 100 lancers',
      'statistic_game_43': '+ de 140 lancers',
      'statistic_game_44': '+ de 170 lancers',
      'statistic_game_45': 'Attaques',
      'statistic_game_46': 'Attaques, %',
      'statistic_game_47': 'Arrêts',
      'statistic_game_48': 'paniers à 3 pts',
      'statistic_game_49': 'paniers à 2 pts',
      'statistic_game_50': 'Lancers francs',
      'statistic_game_51': 'Lancers francs marqués, %',
      'statistic_game_52': 'Temps morts restant',
      'statistic_game_53': 'Fautes',
      'statistic_game_54': 'Possession au cours des 10 dernières minutes, %',
      'statistic_game_55': 'Essais',
      'statistic_game_56': 'Temps passé dans les 22 mètres adverses',
      'statistic_game_57': 'Temps passé dans les 22 mètres adverses',
      'statistic_game_58': 'Attaques dangereuses',
      'statistic_game_59': 'Tirs cadrés',
      'statistic_game_60': 'Tirs non cadrés',
      'statistic_game_61': 'Balles de break',
      'statistic_game_62': 'Pénalités de 2 minutes',
      'statistic_game_63': 'Pénalités de 5 minutes',
      'statistic_game_64': 'Pénalités de 10 minutes',
      'statistic_game_65': 'Engagements gagnés',
      'statistic_game_66': 'Dégagements interdits',
      'statistic_game_67': 'Hors-jeu',
      'statistic_game_68': 'Tirs cadrés',
      'statistic_game_69': 'Tirs de pénalité',
      'statistic_game_70': 'Corners',
      'statistic_game_71': 'Cartons rouges',
      'statistic_game_72': 'Pénalty',
      'statistic_game_73': 'Verges au sol',
      'statistic_game_74': 'Tentatives de rush',
      'statistic_game_75': 'Passes complétées',
      'statistic_game_76': 'Tentatives de passe',
      'statistic_game_77': 'Périodes',
      'statistic_game_78': 'Total de yards',
      'statistic_game_79': 'Moyenne de yards par période',
      'statistic_game_80': 'Efficacité dans le 3e down',
      'statistic_game_81': 'Efficacité dans la zone rouge',
      'statistic_game_82': 'Passes complétées, yards',
      'statistic_game_83': 'Coups francs',
      'statistic_game_84': 'Coups francs dangereux',
      'statistic_game_85': 'Nombre maximum de courses par manche',
      'statistic_game_86': 'Lancers',
      'statistic_game_87': 'Prises',
      'statistic_game_88': 'Balles',
      'statistic_game_89': 'Contres',
      'statistic_game_90': 'Fautes au service',
      'statistic_game_91': 'Exclusions de 20 secondes',
      'statistic_game_92': 'Remplaçants',
      'statistic_game_93': 'xG',
      'statistic_game_94': 'Passes clés',
      'statistic_game_95': 'Précision des passes %',
      'statistic_game_96': 'Centres',
      'statistic_game_97': 'Précision des centres %',
      'statistic_game_98': 'Breaks'
    };
  }

  // Public API methods
  async getStatisticalDictionary() {
    if (!this.statisticalDictionary) {
      await this.loadDictionary();
    }
    return this.statisticalDictionary;
  }

  getRelevantSports() {
    return {
      football: this.footballRelevantStats.size,
      basketball: this.basketballRelevantStats.size,
      tennis: this.tennisRelevantStats.size,
      rugby: this.rugbyRelevantStats.size,
      'american-football': this.americanFootballRelevantStats.size,
      handball: this.handballRelevantStats.size,
      darts: this.dartsRelevantStats.size,
      baseball: this.baseballRelevantStats.size,
      hockey: this.hockeyRelevantStats.size,
      volleyball: this.volleyballRelevantStats.size
    };
  }

  generateStatisticalReport() {
    const report = {
      source: 'TrainCDN Statistical Dictionary',
      url: this.dictionaryUrl,
      totalStatistics: Object.keys(this.statisticalDictionary).length,
      supportedSports: this.getRelevantSports(),
      footballFocus: this.footballRelevantStats.size,
      keyMetrics: this.getFootballStatistics(),
      integrationPotential: this.assessIntegrationPotential(),
      recommendations: this.getRecommendations()
    };

    return report;
  }

  assessIntegrationPotential() {
    const footballStats = this.footballRelevantStats.size;
    const totalStats = Object.keys(this.statisticalDictionary).length;
    const footballRatio = (footballStats / totalStats) * 100;

    return {
      score: footballRatio > 50 ? 'high' : footballRatio > 30 ? 'medium' : 'low',
      footballCoverage: footballRatio.toFixed(1),
      multiSportSupport: totalStats > 50,
      realTimePotential: true,
      bettingRelevance: this.assessBettingRelevance()
    };
  }

  assessBettingRelevance() {
    const bettingRelevantStats = [
      'statistic_game_93', // xG
      'statistic_game_20', // Possession
      'statistic_game_59', // Tirs cadrés
      'statistic_game_60', // Tirs non cadrés
      'statistic_game_11', // Passes décisives
      'statistic_game_26', // Cartons jaunes
      'statistic_game_71'  // Cartons rouges
    ];

    const availableBettingStats = bettingRelevantStats.filter(statId => 
      this.statisticalDictionary[statId]
    ).length;

    return {
      available: availableBettingStats,
      total: bettingRelevantStats.length,
      coverage: ((availableBettingStats / bettingRelevantStats.length) * 100).toFixed(1),
      highValueMetrics: availableBettingStats >= 5
    };
  }

  getRecommendations() {
    return [
      {
        priority: 'HIGH',
        action: 'Integrate xG (statistic_game_93) for advanced betting predictions',
        reasoning: 'Expected Goals is the most predictive metric for football betting'
      },
      {
        priority: 'HIGH',
        action: 'Use possession and shots data for live betting odds',
        reasoning: 'Real-time possession and shot statistics are highly valuable for in-play betting'
      },
      {
        priority: 'MEDIUM',
        action: 'Implement multi-sport support using categorized statistics',
        reasoning: 'Dictionary covers 10+ sports, enabling platform expansion'
      },
      {
        priority: 'MEDIUM',
        action: 'Create statistical models using historical data',
        reasoning: 'Rich dataset enables sophisticated prediction algorithms'
      },
      {
        priority: 'LOW',
        action: 'Add niche sports coverage (darts, volleyball, etc.)',
        reasoning: 'Differentiate from competitors with comprehensive sport coverage'
      }
    ];
  }

  destroy() {
    // Cleanup if needed
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.statisticalAnalyzer = new StatisticalDataAnalyzer();
    });
  } else {
    window.statisticalAnalyzer = new StatisticalDataAnalyzer();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatisticalDataAnalyzer;
}
