import { useState } from 'react';
import { DEVICE_CATEGORIES } from '../config/deviceConfig';
import type { CategoryConfig, DeviceConfig, CreateDeviceInput, DeviceConnectionType } from '../types/device';

interface AddDeviceWizardProps {
  onSave: (device: Omit<CreateDeviceInput, 'patientId'>) => Promise<boolean>;
  onClose: () => void;
  saving: boolean;
}

export function AddDeviceWizard({ onSave, onClose, saving }: AddDeviceWizardProps) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<CategoryConfig | null>(null);
  const [brand, setBrand] = useState<DeviceConfig | null>(null);

  // Scanning state
  const [scanning, setScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<{name: string, mac: string, signalStrength: number}[]>([]);
  const [selectedDeviceMac, setSelectedDeviceMac] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [connectionMethod, setConnectionMethod] = useState<DeviceConnectionType>('bluetooth');

  const startScan = () => {
    setScanning(true);
    setDiscoveredDevices([]);
    // Simulate realistic scan delay & data
    setTimeout(() => {
      setDiscoveredDevices([
        { name: `${brand?.model} - ${Math.floor(Math.random() * 900) + 100}`, mac: '00:1A:7D:DA:71:15', signalStrength: -45 },
        { name: `${brand?.brand} Device (Unknown)`, mac: '00:1A:7D:DA:71:16', signalStrength: -78 },
      ]);
      setScanning(false);
    }, 2500);
  };

  const handleNextStep1 = () => {
    if (category) setStep(2);
  };

  const handleNextStep2 = () => {
    if (brand) {
      setStep(3);
      if (category?.flowType === 'scan') {
        startScan();
      } else {
        // Init default connection method
        if (brand.connectionMethods.length > 0) {
          setConnectionMethod(brand.connectionMethods[0]);
        }
      }
    }
  };

  const handleFinish = async () => {
    if (!category || !brand) return;

    let deviceData: Omit<CreateDeviceInput, 'patientId'> = {
      category: category.id,
      brand: brand.brand,
      model: brand.model,
      connectionType: connectionMethod,
      status: 'connected',
      supportedMetrics: brand.metrics,
      lastSync: new Date().toISOString(),
    };

    if (category.flowType === 'scan') {
      if (!selectedDeviceMac) return;
      const deviceName = discoveredDevices.find((d) => d.mac === selectedDeviceMac)?.name || brand.model;
      deviceData = {
        ...deviceData,
        model: deviceName,
        macAddress: selectedDeviceMac,
        connectionType: 'bluetooth',
      };
    } else if (category.flowType === 'manual_form') {
       deviceData = {
          ...deviceData,
          serialNumber: formData.serialNumber,
       };
    } else if (category.flowType === 'network_config') {
       deviceData = {
          ...deviceData,
          location: formData.location,
          networkProtocol: connectionMethod, // Map the selected method to network protocol
       };
    }

    const success = await onSave(deviceData);
    if (success) {
      onClose();
    }
  };

  const isFormValid = () => {
     if (category?.flowType === 'scan') {
        return !!selectedDeviceMac;
     }
     if (brand?.requiredFields) {
        return brand.requiredFields.every(field => !!formData[field]);
     }
     return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[650px]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 text-white shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined">add_link</span>
              Add New Device
            </h2>
            <button onClick={onClose} className="rounded-full p-1 hover:bg-white/20 transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Select Device Category</h3>
                <p className="text-sm text-slate-500 mt-1">What kind of device are you connecting?</p>
              </div>
              <div className="grid gap-3">
                {DEVICE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                      category?.id === cat.id 
                        ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${category?.id === cat.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <span className="material-symbols-outlined">{cat.icon}</span>
                    </div>
                    <div>
                      <h4 className={`font-bold ${category?.id === cat.id ? 'text-indigo-900' : 'text-slate-800'}`}>{cat.label}</h4>
                      <p className="text-sm text-slate-500">{cat.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Choose Brand & Model</h3>
                <p className="text-sm text-slate-500 mt-1">Select the specific device you want to add.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {category?.brands.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBrand(b)}
                    className={`p-4 rounded-2xl border-2 text-center transition-all ${
                      brand?.id === b.id 
                        ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
                    }`}
                  >
                    <h4 className={`font-bold ${brand?.id === b.id ? 'text-indigo-900' : 'text-slate-800'}`}>{b.brand}</h4>
                    <p className="text-sm font-semibold text-slate-600">{b.model}</p>
                    <p className="text-xs text-slate-400 mt-1">{b.connectionMethods.join(', ').toUpperCase()}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && category?.flowType === 'scan' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Scan & Connect</h3>
                <p className="text-sm text-slate-500 mt-1">Make sure the device is turned on and in pairing mode.</p>
              </div>
              
              {scanning ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="material-symbols-outlined text-4xl text-indigo-600 relative">bluetooth_searching</span>
                  </div>
                  <p className="text-slate-600 font-semibold animate-pulse">Scanning for nearby devices...</p>
                </div>
              ) : (
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                     <span className="font-bold text-slate-700">Discovered Devices</span>
                     <button onClick={startScan} className="text-indigo-600 text-sm font-bold flex items-center gap-1 hover:text-indigo-800">
                        <span className="material-symbols-outlined text-sm">refresh</span> Rescan
                     </button>
                  </div>
                  
                  {discoveredDevices.length === 0 ? (
                    <div className="text-center p-8 border-2 border-dashed border-slate-300 rounded-2xl text-slate-500">
                      No devices found. Ensure bluetooth is on.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {discoveredDevices.map((d) => (
                        <button
                          key={d.mac}
                          onClick={() => setSelectedDeviceMac(d.mac)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            selectedDeviceMac === d.mac
                              ? 'border-emerald-500 bg-emerald-50 shadow-md'
                              : 'border-slate-200 bg-white hover:border-emerald-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined ${selectedDeviceMac === d.mac ? 'text-emerald-600' : 'text-slate-400'}`}>
                              watch
                            </span>
                            <div className="text-left">
                              <h4 className="font-bold text-slate-800">{d.name}</h4>
                              <p className="text-xs font-mono text-slate-500">{d.mac}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                               <div className="flex items-center gap-1 text-slate-400 text-xs font-bold">
                                  <span className="material-symbols-outlined text-[14px]">signal_cellular_alt</span>
                                  {d.signalStrength} dBm
                               </div>
                            </div>
                            {selectedDeviceMac === d.mac && (
                               <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (category?.flowType === 'manual_form' || category?.flowType === 'network_config') && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Device Configuration</h3>
                <p className="text-sm text-slate-500 mt-1">Enter the details for {brand?.brand} {brand?.model}.</p>
              </div>

              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Connection Method</label>
                    <div className="flex gap-2">
                       {brand?.connectionMethods.map(method => (
                          <button 
                             key={method}
                             onClick={() => setConnectionMethod(method)}
                             className={`px-4 py-2 rounded-xl border-2 text-sm font-bold uppercase transition-all ${connectionMethod === method ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:border-indigo-300'}`}
                          >
                             {method}
                          </button>
                       ))}
                    </div>
                 </div>

                 {brand?.requiredFields?.includes('serialNumber') && (
                    <div>
                       <label className="block text-sm font-bold text-slate-700 mb-1">Serial Number</label>
                       <input 
                          type="text" 
                          placeholder="e.g. SN-123456789"
                          value={formData.serialNumber || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                          className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-indigo-600 focus:ring-0 transition-all outline-none"
                       />
                       <p className="text-xs text-slate-500 mt-1">Found on the back of the device or packaging.</p>
                    </div>
                 )}

                 {brand?.requiredFields?.includes('location') && (
                    <div>
                       <label className="block text-sm font-bold text-slate-700 mb-1">Installation Location</label>
                       <input 
                          type="text" 
                          placeholder="e.g. Master Bedroom, Living Room"
                          value={formData.location || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                          className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:border-indigo-600 focus:ring-0 transition-all outline-none"
                       />
                    </div>
                 )}
                 
                 <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex gap-3 mt-4">
                    <span className="material-symbols-outlined text-blue-600">info</span>
                    <p className="text-sm text-blue-800">This device will be automatically assigned to the current resident profile.</p>
                 </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex justify-between shrink-0">
          <button 
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            disabled={saving || (step === 3 && scanning)}
            className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          {step === 1 && (
            <button 
              onClick={handleNextStep1} 
              disabled={!category}
              className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md"
            >
              Continue
            </button>
          )}
          
          {step === 2 && (
            <button 
              onClick={handleNextStep2} 
              disabled={!brand}
              className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md"
            >
              Continue
            </button>
          )}
          
          {step === 3 && (
            <button 
              onClick={() => void handleFinish()} 
              disabled={!isFormValid() || saving || scanning}
              className="px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-md flex items-center gap-2"
            >
              {saving && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
              Save Device
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
