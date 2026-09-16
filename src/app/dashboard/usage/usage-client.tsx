"use client";

import { useUsage } from "@/hooks/use-usage";
import { Loader2, FileText, Copy, Users, Globe, Layers, HardDrive, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";

function UsageStatCard({ title, icon: Icon, data, noun, notAvailableText }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
          <Icon size={20} />
        </div>
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
      </div>
      
      {data?.used === null || data?.used === undefined ? (
        <div className="text-slate-500 font-medium">{notAvailableText || "Not available yet"}</div>
      ) : (
        <div className="space-y-1">
          <div className="text-2xl font-black text-slate-900">
            {data.used} <span className="text-base font-medium text-slate-500">{noun}</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-sm">
            <Infinity size={16} /> Unlimited
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsageClient() {
  const { usage, loading, error } = useUsage();

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 h-8 w-8" />
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center text-center p-8">
        <div className="text-red-500 font-bold text-lg mb-2">Unable to load usage</div>
        <p className="text-slate-500">Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Usage</h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">
            Track your ESign usage across documents, templates, contacts, forms, and storage.
          </p>
        </div>
        
        <div className="flex flex-col items-end">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Current Plan</div>
          <div className="bg-blue-100 text-blue-700 font-bold px-3 py-1.5 rounded-lg text-sm border border-blue-200">
            {usage.planName}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <UsageStatCard 
          title="Documents" 
          icon={FileText} 
          data={usage.documents} 
          noun="documents" 
        />
        <UsageStatCard 
          title="Templates" 
          icon={Copy} 
          data={usage.templates} 
          noun="templates" 
        />
        <UsageStatCard 
          title="Contacts" 
          icon={Users} 
          data={usage.contacts} 
          noun="contacts" 
        />
        <UsageStatCard 
          title="Public Forms" 
          icon={Globe} 
          data={usage.publicForms} 
          noun="forms" 
        />
        <UsageStatCard 
          title="Form Submissions" 
          icon={Globe} 
          data={usage.publicFormSubmissions} 
          noun="submissions" 
        />
        <UsageStatCard 
          title="Bulk Send Batches" 
          icon={Layers} 
          data={usage.bulkSendBatches} 
          noun="batches" 
        />
        <UsageStatCard 
          title="Bulk Send Recipients" 
          icon={Layers} 
          data={usage.bulkSendRecipients} 
          noun="recipients" 
        />
        <UsageStatCard 
          title="Storage" 
          icon={HardDrive} 
          data={usage.storage} 
          noun="MB used" 
          notAvailableText="Not available yet" 
        />
      </div>
      
      {/* Footer / Upgrade */}
      <div className="mt-8 border-t pt-8 text-center">
        <Button className="bg-[#1A56DB] hover:bg-blue-700 text-white font-bold h-11 px-8 rounded-full shadow-lg hover:shadow-xl transition-all">
          Upgrade Plan
        </Button>
      </div>
    </div>
  );
}
