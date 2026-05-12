import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEldercare } from '../context/EldercareContext';

function listToText(values: string[]) {
  return values.join(', ');
}

type ProfileFormState = {
  id: string;
  fullName: string;
  photoUrl: string;
  age: number;
  gender: string;
  bloodGroup: string;
  heightCm: number;
  weightKg: number;
  conditions: string;
  allergies: string;
  careNotes: string;
  baseline: {
    minHeartRate: number;
    maxHeartRate: number;
    minSpo2: number;
    maxSystolic: number;
    maxDiastolic: number;
    dailyStepsTarget: number;
    sleepTargetHours: number;
    hydrationTargetLiters: number;
  };
};

const defaultPhoto =
  'https://images.unsplash.com/photo-1581579438747-104c53d10f48?auto=format&fit=crop&w=900&q=80';

export default function ResidentProfile() {
  const { profile: userProfile } = useAuth();
  const { data, updateProfile, createContact, updateDevice, storageMode } = useEldercare();
  const [saveMessage, setSaveMessage] = useState('');

  const [contactForm, setContactForm] = useState({
    name: '',
    relation: '',
    role: '',
    phone: '',
    notifyOnEmergency: true,
  });

  const [deviceForm, setDeviceForm] = useState({
    source: 'fitbit' as const,
    connected: true,
    status: 'active' as const,
    notes: '',
  });

  const [form, setForm] = useState<ProfileFormState | null>(null);

  useEffect(() => {
    if (!data) {
      return;
    }
    setForm({
      ...data.profile,
      photoUrl: data.profile.photoUrl || defaultPhoto,
      conditions: listToText(data.profile.conditions),
      allergies: listToText(data.profile.allergies),
    });
  }, [data]);

  if (!data || !form) {
    return <div className="text-slate-500">Loading resident profile...</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-primary">Resident Profile</h1>
          <p className="text-slate-500">Edit resident photo, personal details, health baseline, contacts, and connected devices.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 uppercase">
            {storageMode} mode
          </span>
          <span className="inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 uppercase">
            {userProfile?.role ?? 'user'}
          </span>
        </div>
      </header>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <form
          className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void updateProfile({
              ...data.profile,
              fullName: form.fullName,
              photoUrl: form.photoUrl,
              age: Number(form.age),
              gender: form.gender,
              bloodGroup: form.bloodGroup,
              heightCm: Number(form.heightCm),
              weightKg: Number(form.weightKg),
              conditions: form.conditions.split(',').map((item) => item.trim()).filter(Boolean),
              allergies: form.allergies.split(',').map((item) => item.trim()).filter(Boolean),
              careNotes: form.careNotes,
              baseline: {
                minHeartRate: Number(form.baseline.minHeartRate),
                maxHeartRate: Number(form.baseline.maxHeartRate),
                minSpo2: Number(form.baseline.minSpo2),
                maxSystolic: Number(form.baseline.maxSystolic),
                maxDiastolic: Number(form.baseline.maxDiastolic),
                dailyStepsTarget: Number(form.baseline.dailyStepsTarget),
                sleepTargetHours: Number(form.baseline.sleepTargetHours),
                hydrationTargetLiters: Number(form.baseline.hydrationTargetLiters),
              },
            }).then(() => setSaveMessage('Profile updated successfully.'));
          }}
        >
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            <div className="space-y-4 rounded-[28px] bg-slate-50 p-5">
              <img
                alt="Resident"
                className="h-56 w-full rounded-[24px] object-cover shadow-sm"
                src={form.photoUrl || defaultPhoto}
              />
              <input
                type="url"
                placeholder="Paste photo URL"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                value={form.photoUrl}
                onChange={(event) => setForm({ ...form, photoUrl: event.target.value })}
              />
              <label className="block rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                Upload photo
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-xs"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }

                    const reader = new FileReader();
                    reader.onload = () => {
                      const nextPhotoUrl = typeof reader.result === 'string' ? reader.result : '';
                      if (nextPhotoUrl) {
                        setForm((current) => (current ? { ...current, photoUrl: nextPhotoUrl } : current));
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <div className="rounded-2xl bg-white p-4 text-sm text-slate-600">
                Use an image URL or upload directly from this device. Uploaded image preview is stored in the profile data.
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-bold text-slate-600">Full name</span>
                  <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-bold text-slate-600">Age</span>
                  <input type="number" className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.age} onChange={(event) => setForm({ ...form, age: Number(event.target.value) })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-bold text-slate-600">Gender</span>
                  <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-bold text-slate-600">Blood group</span>
                  <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.bloodGroup} onChange={(event) => setForm({ ...form, bloodGroup: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-bold text-slate-600">Height (cm)</span>
                  <input type="number" className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.heightCm} onChange={(event) => setForm({ ...form, heightCm: Number(event.target.value) })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-bold text-slate-600">Weight (kg)</span>
                  <input type="number" className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.weightKg} onChange={(event) => setForm({ ...form, weightKg: Number(event.target.value) })} />
                </label>
              </div>

              <div className="grid gap-4">
                <label className="space-y-2">
                  <span className="text-sm font-bold text-slate-600">Conditions</span>
                  <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.conditions} onChange={(event) => setForm({ ...form, conditions: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-bold text-slate-600">Allergies</span>
                  <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.allergies} onChange={(event) => setForm({ ...form, allergies: event.target.value })} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-bold text-slate-600">Care notes</span>
                  <textarea className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3" value={form.careNotes} onChange={(event) => setForm({ ...form, careNotes: event.target.value })} />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-slate-50 p-6">
            <h2 className="text-2xl font-bold text-primary">Health baseline</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['Minimum heart rate', 'minHeartRate'],
                ['Maximum heart rate', 'maxHeartRate'],
                ['Minimum SpO2', 'minSpo2'],
                ['Maximum systolic', 'maxSystolic'],
                ['Maximum diastolic', 'maxDiastolic'],
                ['Steps target', 'dailyStepsTarget'],
                ['Sleep target (hours)', 'sleepTargetHours'],
                ['Hydration target (liters)', 'hydrationTargetLiters'],
              ].map(([label, key]) => (
                <label key={key} className="space-y-2">
                  <span className="text-sm font-bold text-slate-600">{label}</span>
                  <input
                    type="number"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3"
                    value={form.baseline[key as keyof typeof form.baseline]}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        baseline: { ...form.baseline, [key]: Number(event.target.value) },
                      })
                    }
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button className="rounded-2xl bg-primary px-6 py-3 font-bold text-white transition hover:bg-blue-800">
              Save profile
            </button>
            {saveMessage ? <span className="text-sm font-bold text-green-700">{saveMessage}</span> : null}
          </div>
        </form>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-primary">Care contacts</h2>
            <div className="mt-4 space-y-3">
              {data.contacts.map((contact) => (
                <div key={contact.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="font-bold text-slate-800">{contact.name}</div>
                  <div className="text-sm text-slate-500">{contact.role} | {contact.phone}</div>
                </div>
              ))}
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createContact(contactForm).then(() => setSaveMessage('Emergency contact added.'));
                setContactForm({ name: '', relation: '', role: '', phone: '', notifyOnEmergency: true });
              }}
            >
              <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Contact name" value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} />
              <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Relation" value={contactForm.relation} onChange={(event) => setContactForm({ ...contactForm, relation: event.target.value })} />
              <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Role" value={contactForm.role} onChange={(event) => setContactForm({ ...contactForm, role: event.target.value })} />
              <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Phone number" value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} />
              <button className="w-full rounded-2xl bg-secondary px-4 py-3 font-bold text-white transition hover:bg-green-700">
                Add contact
              </button>
            </form>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-primary">Devices</h2>
            <div className="mt-4 space-y-3">
              {data.devices.map((device) => (
                <div key={device.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="font-bold capitalize text-slate-800">{device.source.replace('_', ' ')}</div>
                  <div className="text-sm text-slate-500">
                    {device.status}
                    {device.lastSyncedAt ? ` | ${new Date(device.lastSyncedAt).toLocaleString()}` : ''}
                  </div>
                </div>
              ))}
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void updateDevice(deviceForm).then(() => setSaveMessage('Device updated.'));
                setDeviceForm({ source: 'fitbit', connected: true, status: 'active', notes: '' });
              }}
            >
              <select className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={deviceForm.source} onChange={(event) => setDeviceForm({ ...deviceForm, source: event.target.value as typeof deviceForm.source })}>
                <option value="fitbit">Fitbit</option>
                <option value="health_connect">Health Connect</option>
                <option value="apple_health">Apple Health</option>
                <option value="manual">Manual</option>
              </select>
              <select className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={deviceForm.status} onChange={(event) => setDeviceForm({ ...deviceForm, status: event.target.value as typeof deviceForm.status })}>
                <option value="active">Active</option>
                <option value="attention">Attention</option>
                <option value="disconnected">Disconnected</option>
              </select>
              <textarea className="min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Connection notes" value={deviceForm.notes} onChange={(event) => setDeviceForm({ ...deviceForm, notes: event.target.value })} />
              <button className="w-full rounded-2xl bg-primary px-4 py-3 font-bold text-white transition hover:bg-blue-800">
                Save device
              </button>
            </form>
          </section>
        </div>
      </section>
    </div>
  );
}
