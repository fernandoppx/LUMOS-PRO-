import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f3f5f9] dark:bg-[#0e1320]">
      <div className="max-w-md w-full bg-white dark:bg-[#161d2e] rounded-2xl shadow-xl p-8 text-center">
        <ShieldCheck className="w-10 h-10 mx-auto mb-4 text-[#2f55d4]" />

        <h1 className="text-2xl font-black mb-2">
          LUMOS PRO
        </h1>

        <p className="text-sm text-slate-500">
          O acesso ao sistema é restrito à equipe
          autorizada. A verificação de acesso
          é realizada pelo servidor.
        </p>
      </div>
    </div>
  );
};
