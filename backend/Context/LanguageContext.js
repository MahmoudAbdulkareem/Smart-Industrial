import { createContext, useContext, useState } from "react";

const LanguageContext = createContext();

const translations = {
  en: {
    dashboard: "Dashboard",
    health: "Health View",
    energy: "Energy View",
    alerts: "Alerts",
    login: "Login",
    logout: "Logout",
    createWorkOrder: "Create Work Order",
    refresh: "Refresh",
    active: "Active",
    acknowledged: "Acknowledged",
  },
  fr: {
    dashboard: "Tableau de bord",
    health: "Vue Santé",
    energy: "Vue Énergie",
    alerts: "Alertes",
    login: "Connexion",
    logout: "Déconnexion",
    createWorkOrder: "Créer un ordre de travail",
    refresh: "Actualiser",
    active: "Actif",
    acknowledged: "Acquitté",
  },
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("en");
  const t = (key) => translations[language][key] || key;

  return (
    <LanguageContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}