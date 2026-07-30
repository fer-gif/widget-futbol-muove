export default function TestProdeIframePage() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 0, backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      <header style={{ backgroundColor: "#0f172a", color: "#ffffff", padding: "20px", textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: "24px" }}>Página de Ejemplo de Data eNe</h1>
        <p style={{ margin: "5px 0 0", opacity: 0.8, fontSize: "14px" }}>
          Prueba de incrustación segura del Prode a través de iFrame
        </p>
      </header>

      <div style={{ maxWidth: "1100px", margin: "30px auto", padding: "0 15px" }}>
        <div style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: "18px", color: "#0f172a" }}>Sección de Deportes & Prode Oficial</h2>
          <p style={{ color: "#64748b", fontSize: "14px", marginBottom: "20px" }}>
            A continuación se renderiza el iFrame exacto que Vorks utilizará en la web:
          </p>

          {/* CÓDIGO EXACTO DEL IFRAME */}
          <iframe
            src="/prode"
            style={{ width: "100%", height: "1100px", border: "none", borderRadius: "12px" }}
            allow="clipboard-write"
          />
        </div>
      </div>

      <footer style={{ textAlign: "center", padding: "20px", fontSize: "12px", color: "#64748b" }}>
        <p>© 2026 Data eNe - Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
