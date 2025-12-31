import React from 'react';

function BasicTestApp() {
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      backgroundColor: '#1f2937', 
      color: 'white', 
      padding: '2rem',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ 
        fontSize: '2rem', 
        fontWeight: 'bold', 
        color: '#8b5cf6', 
        marginBottom: '1rem' 
      }}>
        基础样式测试
      </h1>
      
      <p style={{ 
        fontSize: '1.1rem', 
        color: '#d1d5db', 
        marginBottom: '2rem' 
      }}>
        这个页面使用内联样式，不依赖 Tailwind CSS
      </p>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer'
        }}>
          蓝色按钮
        </button>
        
        <button style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer'
        }}>
          绿色按钮
        </button>
        
        <button style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#ef4444',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer'
        }}>
          红色按钮
        </button>
      </div>
      
      <div style={{
        padding: '1rem',
        backgroundColor: '#374151',
        borderRadius: '0.5rem',
        border: '1px solid #4b5563'
      }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          测试卡片
        </h3>
        <p style={{ color: '#9ca3af' }}>
          如果您能看到这个卡片和上面的彩色按钮，说明基础样式是工作的
        </p>
      </div>
      
      <div style={{ marginTop: '2rem' }}>
        <h4 style={{ marginBottom: '1rem' }}>诊断信息：</h4>
        <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', color: '#d1d5db' }}>
          <li>React 组件：✅ 正常</li>
          <li>内联样式：✅ 正常</li>
          <li>JavaScript：✅ 正常</li>
          <li>Tailwind CSS：需要测试</li>
        </ul>
      </div>
    </div>
  );
}

export default BasicTestApp;