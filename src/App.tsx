import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Disqualified from "./pages/Disqualified";
import Success from "./pages/Success";
import Biometria from "./pages/Biometria";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Login from "./pages/Login";
import AcessoPortal from "./pages/AcessoPortal";
import AdminLayout from "./components/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Leads from "./pages/admin/Leads";
import Qualifications from "./pages/admin/Qualifications";
import Payments from "./pages/admin/Payments";
import Documents from "./pages/admin/Documents";
import FormularioAbertura from "./pages/FormularioAbertura";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/desqualificado" element={<Disqualified />} />
          <Route path="/sucesso" element={<Success />} />
          <Route path="/biometria" element={<Biometria />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Login />} />
          <Route path="/acesso-portal" element={<AcessoPortal />} />
          <Route path="/formulario-abertura" element={<FormularioAbertura />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="qualifications" element={<Qualifications />} />
            <Route path="payments" element={<Payments />} />
            <Route path="documents" element={<Documents />} />
          </Route>
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
