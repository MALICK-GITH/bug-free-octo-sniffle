// Interactive Charts for Match Details - Integrated Design
class MatchInteractiveCharts {
  constructor() {
    this.charts = {};
    this.currentMatchId = null;
    this.chartColors = {
      primary: '#3be7ff',
      secondary: '#42f56c', 
      accent: '#ffd166',
      danger: '#ff5f79',
      background: 'rgba(15, 25, 49, 0.9)',
      grid: 'rgba(59, 231, 255, 0.1)',
      text: '#d8e7f8'
    };
    
    this.init();
  }

  init() {
    console.log('📊 Initializing Interactive Charts...');
    this.setupChartContainer();
    this.loadChartLibrary();
  }

  setupChartContainer() {
    const analyticsPanel = document.querySelector('.analytics-panel');
    if (!analyticsPanel) return;

    // Insert charts section before existing charts
    const chartsSection = document.createElement('div');
    chartsSection.className = 'interactive-charts-section';
    chartsSection.innerHTML = `
      <div class="charts-header">
        <h3>📊 Analyse Interactive des Cotes</h3>
        <div class="chart-controls">
          <button class="chart-btn active" data-chart="odds">Cotes</button>
          <button class="chart-btn" data-chart="probability">Probabilités</button>
          <button class="chart-btn" data-chart="trends">Tendances</button>
          <button class="chart-btn" data-chart="comparison">Comparaison</button>
        </div>
      </div>
      <div class="charts-container">
        <div class="chart-wrapper active" id="oddsChart">
          <canvas id="oddsCanvas"></canvas>
          <div class="chart-legend">
            <div class="legend-item"><span class="legend-color" style="background: #3be7ff"></span> Domicile</div>
            <div class="legend-item"><span class="legend-color" style="background: #42f56c"></span> Nul</div>
            <div class="legend-item"><span class="legend-color" style="background: #ffd166"></span> Extérieur</div>
          </div>
        </div>
        <div class="chart-wrapper" id="probabilityChart">
          <canvas id="probabilityCanvas"></canvas>
        </div>
        <div class="chart-wrapper" id="trendsChart">
          <canvas id="trendsCanvas"></canvas>
        </div>
        <div class="chart-wrapper" id="comparisonChart">
          <canvas id="comparisonCanvas"></canvas>
        </div>
      </div>
    `;

    analyticsPanel.insertBefore(chartsSection, analyticsPanel.querySelector('.chart-grid'));
    this.setupChartControls();
  }

  setupChartControls() {
    const buttons = document.querySelectorAll('.chart-btn');
    const wrappers = document.querySelectorAll('.chart-wrapper');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const chartType = btn.dataset.chart;
        
        // Update active states
        buttons.forEach(b => b.classList.remove('active'));
        wrappers.forEach(w => w.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(`${chartType}Chart`).classList.add('active');
        
        // Render chart
        this.renderChart(chartType);
      });
    });
  }

  loadChartLibrary() {
    // Chart.js is already loaded in match.html
    if (typeof Chart !== 'undefined') {
      this.initializeCharts();
    } else {
      setTimeout(() => this.loadChartLibrary(), 100);
    }
  }

  initializeCharts() {
    // Initialize with default odds chart
    setTimeout(() => this.renderChart('odds'), 500);
  }

  renderChart(type) {
    // Destroy existing chart
    if (this.charts[type]) {
      this.charts[type].destroy();
    }

    const canvas = document.getElementById(`${type}Canvas`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    switch(type) {
      case 'odds':
        this.renderOddsChart(ctx);
        break;
      case 'probability':
        this.renderProbabilityChart(ctx);
        break;
      case 'trends':
        this.renderTrendsChart(ctx);
        break;
      case 'comparison':
        this.renderComparisonChart(ctx);
        break;
    }
  }

  renderOddsChart(ctx) {
    const data = this.generateMockOddsData();
    
    this.charts.odds = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Domicile',
            data: data.home,
            borderColor: this.chartColors.primary,
            backgroundColor: 'rgba(59, 231, 255, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Nul',
            data: data.draw,
            borderColor: this.chartColors.secondary,
            backgroundColor: 'rgba(66, 245, 108, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Extérieur',
            data: data.away,
            borderColor: this.chartColors.accent,
            backgroundColor: 'rgba(255, 209, 102, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(8, 16, 32, 0.9)',
            titleColor: this.chartColors.text,
            bodyColor: this.chartColors.text,
            borderColor: this.chartColors.primary,
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: this.chartColors.grid,
              borderColor: this.chartColors.primary
            },
            ticks: {
              color: this.chartColors.text
            }
          },
          y: {
            grid: {
              color: this.chartColors.grid,
              borderColor: this.chartColors.primary
            },
            ticks: {
              color: this.chartColors.text,
              callback: function(value) {
                return value.toFixed(2);
              }
            }
          }
        }
      }
    });
  }

  renderProbabilityChart(ctx) {
    const data = this.generateProbabilityData();
    
    this.charts.probability = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Domicile', 'Nul', 'Extérieur', 'Marge'],
        datasets: [{
          data: data,
          backgroundColor: [
            this.chartColors.primary,
            this.chartColors.secondary,
            this.chartColors.accent,
            'rgba(255, 95, 121, 0.7)'
          ],
          borderColor: 'rgba(15, 25, 49, 0.9)',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: this.chartColors.text,
              padding: 20,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(8, 16, 32, 0.9)',
            titleColor: this.chartColors.text,
            bodyColor: this.chartColors.text,
            borderColor: this.chartColors.primary,
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: function(context) {
                return `${context.label}: ${context.parsed}%`;
              }
            }
          }
        }
      }
    });
  }

  renderTrendsChart(ctx) {
    const data = this.generateTrendsData();
    
    this.charts.trends = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Volume de Paris',
            data: data.volume,
            backgroundColor: 'rgba(59, 231, 255, 0.7)',
            borderColor: this.chartColors.primary,
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Confiance IA',
            data: data.confidence,
            backgroundColor: 'rgba(66, 245, 108, 0.7)',
            borderColor: this.chartColors.secondary,
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: this.chartColors.text
            }
          },
          tooltip: {
            backgroundColor: 'rgba(8, 16, 32, 0.9)',
            titleColor: this.chartColors.text,
            bodyColor: this.chartColors.text,
            borderColor: this.chartColors.primary,
            borderWidth: 1,
            padding: 12
          }
        },
        scales: {
          x: {
            grid: {
              color: this.chartColors.grid,
              borderColor: this.chartColors.primary
            },
            ticks: {
              color: this.chartColors.text
            }
          },
          y: {
            grid: {
              color: this.chartColors.grid,
              borderColor: this.chartColors.primary
            },
            ticks: {
              color: this.chartColors.text,
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });
  }

  renderComparisonChart(ctx) {
    const data = this.generateComparisonData();
    
    this.charts.comparison = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Cote', 'Confiance', 'Valeur', 'Risque', 'Liquidité', 'Historique'],
        datasets: [
          {
            label: 'Match Actuel',
            data: data.current,
            borderColor: this.chartColors.primary,
            backgroundColor: 'rgba(59, 231, 255, 0.2)',
            borderWidth: 2,
            pointRadius: 4
          },
          {
            label: 'Moyenne Ligue',
            data: data.average,
            borderColor: this.chartColors.secondary,
            backgroundColor: 'rgba(66, 245, 108, 0.2)',
            borderWidth: 2,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: this.chartColors.text
            }
          },
          tooltip: {
            backgroundColor: 'rgba(8, 16, 32, 0.9)',
            titleColor: this.chartColors.text,
            bodyColor: this.chartColors.text,
            borderColor: this.chartColors.primary,
            borderWidth: 1,
            padding: 12
          }
        },
        scales: {
          r: {
            grid: {
              color: this.chartColors.grid
            },
            pointLabels: {
              color: this.chartColors.text
            },
            ticks: {
              color: this.chartColors.text,
              backdropColor: 'transparent'
            }
          }
        }
      }
    });
  }

  // Mock data generators - replace with real API calls
  generateMockOddsData() {
    const hours = Array.from({length: 24}, (_, i) => `${i}h`);
    return {
      labels: hours,
      home: hours.map(() => 1.8 + Math.random() * 0.4),
      draw: hours.map(() => 3.2 + Math.random() * 0.6),
      away: hours.map(() => 4.1 + Math.random() * 0.8)
    };
  }

  generateProbabilityData() {
    return [
      45, // Domicile
      28, // Nul
      22, // Extérieur
      5   // Marge
    ];
  }

  generateTrendsData() {
    return {
      labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
      volume: [65, 78, 90, 81, 95, 88, 92],
      confidence: [72, 75, 78, 74, 82, 79, 85]
    };
  }

  generateComparisonData() {
    return {
      current: [85, 78, 92, 45, 88, 76],
      average: [72, 68, 75, 55, 80, 70]
    };
  }

  updateData(matchData) {
    this.currentMatchId = matchData.id;
    // Update charts with real data when available
    this.refreshAllCharts();
  }

  refreshAllCharts() {
    Object.keys(this.charts).forEach(type => {
      if (document.getElementById(`${type}Chart`).classList.contains('active')) {
        this.renderChart(type);
      }
    });
  }

  destroy() {
    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
    this.charts = {};
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.matchCharts = new MatchInteractiveCharts();
    });
  } else {
    window.matchCharts = new MatchInteractiveCharts();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MatchInteractiveCharts;
}
