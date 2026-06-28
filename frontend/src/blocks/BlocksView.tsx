function BlocksView() {
  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#1a1a1a',
      color: '#ccc',
      fontFamily: 'monospace',
      fontSize: '16px'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h2>🟦 Vue Blocs Visuels</h2>
        <p>Équipe A: Adel & Junior</p>
        <p>Cette vue affichera la structure du code sous forme de blocs</p>
        <p style={{ marginTop: '20px', fontSize: '14px', color: '#888' }}>
          Connectée à l'AST via le store de synchronisation
        </p>
      </div>
    </div>
  );
}

export default BlocksView;