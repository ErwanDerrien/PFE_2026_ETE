function NaturalLangView() {
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
        <h2>📝 Vue Langage Naturel</h2>
        <p>Émie (rôle transversal)</p>
        <p>Cette vue convertira le code en description textuelle via API Claude</p>
        <p style={{ marginTop: '20px', fontSize: '14px', color: '#888' }}>
          Intégration API Claude + conversions code ↔ langage naturel
        </p>
      </div>
    </div>
  );
}

export default NaturalLangView;