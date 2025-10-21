import React from 'react';

// أبسط مكون ممكن
const App: React.FC = () => {
    return (
        <div style={{ padding: '20px', color: 'white', backgroundColor: '#1f2937', height: '100vh' }}>
            <h1>Hello World - Test</h1>
            <p>If you see this, the basic React setup is working.</p>
        </div>
    );
};

export default App;