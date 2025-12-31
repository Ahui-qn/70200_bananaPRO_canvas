import React, { useState } from 'react';

// 内联样式，不依赖 Tailwind CSS
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e293b 0%, #7c3aed 50%, #1e293b 100%)',
    color: 'white',
    fontFamily: 'Arial, sans-serif',
    padding: '20px'
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '40px'
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginBottom: '10px'
  },
  subtitle: {
    fontSize: '1.2rem',
    opacity: 0.8,
    marginBottom: '30px'
  },
  buttonContainer: {
    display: 'flex',
    gap: '15px',
    justifyContent: 'center',
    flexWrap: 'wrap' as const,
    marginBottom: '40px'
  },
  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    color: 'white'
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
  },
  successButton: {
    backgroundColor: '#10b981',
  },
  warningButton: {
    backgroundColor: '#f59e0b',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '12px'
  },
  cardContent: {
    opacity: 0.9,
    lineHeight: 1.6
  },
  statusIndicator: {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    marginRight: '8px'
  },
  statusOnline: {
    backgroundColor: '#10b981'
  },
  statusOffline: {
    backgroundColor: '#ef4444'
  }
};

function BasicApp() {
  const [backendStatus, setBackendStatus] = useState('离线');
  const [apiConfigured, setApiConfigured] = useState(false);

  const testConnection = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        setBackendStatus('在线');
        alert('后端连接成功！');
      } else {
        setBackendStatus('离线');
        alert('后端连接失败');
      }
    } catch (error) {
      setBackendStatus('离线');
      alert('无法连接到后端服务器');
    }
  };

  const configureAPI = () => {
    setApiConfigured(!apiConfigured);
    alert(apiConfigured ? 'API 配置已清除' : 'API 配置已设置');
  };

  const showStyleTest = () => {
    alert('样式测试：如果您能看到这个美观的界面，说明样式已正常加载！');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Nano Banana AI 画布</h1>
        <p style={styles.subtitle}>强大的 AI 图片生成工具，让创意无限可能</p>
        
        <div style={styles.buttonContainer}>
          <button 
            style={{...styles.button, ...styles.primaryButton}}
            onClick={testConnection}
            onMouseOver={(e) => e.target.style.backgroundColor = '#6d28d9'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#7c3aed'}
          >
            🔗 测试连接
          </button>
          
          <button 
            style={{...styles.button, ...styles.successButton}}
            onClick={configureAPI}
            onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
          >
            ⚙️ API 配置
          </button>
          
          <button 
            style={{...styles.button, ...styles.warningButton}}
            onClick={showStyleTest}
            onMouseOver={(e) => e.target.style.backgroundColor = '#d97706'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#f59e0b'}
          >
            🎨 样式测试
          </button>
        </div>
      </div>

      <div style={styles.cardGrid}>
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>
            <span style={{...styles.statusIndicator, ...(backendStatus === '在线' ? styles.statusOnline : styles.statusOffline)}}></span>
            后端服务状态
          </h3>
          <div style={styles.cardContent}>
            <p>状态: {backendStatus}</p>
            <p>端口: 3002</p>
            <p>健康检查: /api/health</p>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>
            <span style={{...styles.statusIndicator, ...(apiConfigured ? styles.statusOnline : styles.statusOffline)}}></span>
            API 配置
          </h3>
          <div style={styles.cardContent}>
            <p>状态: {apiConfigured ? '已配置' : '未配置'}</p>
            <p>提供商: Nano Banana</p>
            <p>超时: 300秒</p>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>
            <span style={{...styles.statusIndicator, ...styles.statusOffline}}></span>
            数据库连接
          </h3>
          <div style={styles.cardContent}>
            <p>状态: 未连接</p>
            <p>类型: MySQL</p>
            <p>配置: 待设置</p>
          </div>
        </div>

        <div style={styles.card}>
          <h3 style={styles.cardTitle}>
            <span style={{...styles.statusIndicator, ...styles.statusOffline}}></span>
            云存储
          </h3>
          <div style={styles.cardContent}>
            <p>状态: 待配置</p>
            <p>类型: 阿里云 OSS</p>
            <p>区域: 待选择</p>
          </div>
        </div>
      </div>

      <div style={{textAlign: 'center', marginTop: '40px', opacity: 0.7}}>
        <p>前端端口: 3000 | 后端端口: 3002 | 架构: 前后端分离</p>
      </div>
    </div>
  );
}

export default BasicApp;