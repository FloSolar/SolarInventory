import React, { useState, useEffect, useMemo } from 'react';
import { 
  Menu, X, Home, PackagePlus, List, Briefcase, Settings, 
  TrendingUp, Box, Battery, Cpu, AlertCircle, CheckCircle, 
  Trash2, Edit, ArrowRightLeft, Plus
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, updateDoc, deleteDoc, onSnapshot, 
  collection, addDoc 
} from 'firebase/firestore';

// --- Firebase Initialization ---
// Fallback configuration for preview/dev if global vars are not injected
const defaultFirebaseConfig = { projectId: "demo-project" };
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : defaultFirebaseConfig;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'solar-stock-manager';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper function to get collection references using strictly required paths
const getColRef = (colName) => collection(db, 'artifacts', appId, 'public', 'data', colName);
const getDocRef = (colName, docId) => doc(db, 'artifacts', appId, 'public', 'data', colName, docId);

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data States
  const [owners, setOwners] = useState([]);
  const [presets, setPresets] = useState([]);
  const [stock, setStock] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);

  // Auth Effect
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
        setError("Failed to authenticate.");
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Data Subscription Effect
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const unsubOwners = onSnapshot(getColRef('owners'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Initialize default owners if empty
      if (data.length === 0) {
        ['Owner 1', 'Owner 2', 'Owner 3', 'Owner 4', 'Owner 5'].forEach((name, idx) => {
          setDoc(getDocRef('owners', `owner_${idx}`), { name, order: idx });
        });
      } else {
        setOwners(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
      }
    }, (err) => console.error(err));

    const unsubPresets = onSnapshot(getColRef('presets'), (snapshot) => {
      setPresets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error(err));

    const unsubStock = onSnapshot(getColRef('stock'), (snapshot) => {
      setStock(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error(err));

    const unsubJobs = onSnapshot(getColRef('jobs'), (snapshot) => {
      setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => new Date(b.date) - new Date(a.date)));
    }, (err) => console.error(err));
    
    const unsubLogs = onSnapshot(getColRef('logs'), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => new Date(b.date) - new Date(a.date)));
    }, (err) => console.error(err));

    setLoading(false);

    return () => {
      unsubOwners();
      unsubPresets();
      unsubStock();
      unsubJobs();
      unsubLogs();
    };
  }, [user]);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
  };

  const getPresetName = (preset) => {
    if (!preset) return 'Unknown';
    if (preset.category === 'panels') return `${preset.brand} ${preset.modelType}W`;
    if (preset.category === 'inverters') return `${preset.brand} ${preset.modelType}kW - ${preset.type}`;
    if (preset.category === 'batteries') return `${preset.brand} ${preset.modelType}`;
    return `${preset.brand} ${preset.modelType}`;
  };

  // Shared generic components
  const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-6 ${className}`}>
      {children}
    </div>
  );

  const Input = ({ label, ...props }) => (
    <div className="flex flex-col mb-4">
      {label && <label className="mb-1 text-sm font-semibold text-slate-700">{label}</label>}
      <input 
        className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-slate-100" 
        {...props} 
      />
    </div>
  );
  
  const Select = ({ label, children, ...props }) => (
    <div className="flex flex-col mb-4">
      {label && <label className="mb-1 text-sm font-semibold text-slate-700">{label}</label>}
      <select 
        className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-slate-100 bg-white" 
        {...props}
      >
        {children}
      </select>
    </div>
  );

  const Button = ({ children, variant = 'primary', className = "", ...props }) => {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
      primary: "bg-blue-600 text-white hover:bg-blue-700",
      secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
      danger: "bg-red-50 text-red-600 hover:bg-red-100",
      outline: "border border-slate-300 bg-transparent hover:bg-slate-50 text-slate-700"
    };
    return (
      <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
        {children}
      </button>
    );
  };

  const AdminTab = () => {
    const [editingOwner, setEditingOwner] = useState(null);
    const [newPresetCategory, setNewPresetCategory] = useState('panels');
    
    // Preset Form State
    const [presetForm, setPresetForm] = useState({ brand: '', modelType: '', type: '', cost: '' });
    const [editingPreset, setEditingPreset] = useState(null);

    const handleUpdateOwner = async (id, newName) => {
      await updateDoc(getDocRef('owners', id), { name: newName });
      setEditingOwner(null);
    };

    const handleSavePreset = async (e) => {
      e.preventDefault();
      const payload = {
        category: newPresetCategory,
        brand: presetForm.brand,
        modelType: presetForm.modelType,
        type: newPresetCategory === 'inverters' || newPresetCategory === 'batteries' ? presetForm.type : null,
        cost: parseFloat(presetForm.cost) || 0
      };

      if (editingPreset) {
        await updateDoc(getDocRef('presets', editingPreset), payload);
        setEditingPreset(null);
      } else {
        await addDoc(getColRef('presets'), payload);
      }
      setPresetForm({ brand: '', modelType: '', type: '', cost: '' });
    };

    const handleDeletePreset = async (id) => {
      if(window.confirm("Are you sure? This may affect historical data if not handled carefully.")) {
        await deleteDoc(getDocRef('presets', id));
      }
    };

    return (
      <div className="space-y-6">
        <Card>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Briefcase className="w-5 h-5"/> Manage Owners</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {owners.map(owner => (
              <div key={owner.id} className="p-4 border rounded-lg bg-slate-50 flex justify-between items-center">
                {editingOwner === owner.id ? (
                  <input 
                    autoFocus
                    defaultValue={owner.name}
                    onBlur={(e) => handleUpdateOwner(owner.id, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateOwner(owner.id, e.target.value)}
                    className="px-2 py-1 border rounded w-full mr-2"
                  />
                ) : (
                  <span className="font-semibold">{owner.name}</span>
                )}
                <button onClick={() => setEditingOwner(owner.id)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><PackagePlus className="w-5 h-5"/> Master Presets</h2>
          
          <div className="flex gap-2 mb-6 border-b pb-2">
            {['panels', 'inverters', 'batteries'].map(cat => (
              <button
                key={cat}
                onClick={() => { setNewPresetCategory(cat); setPresetForm({ brand: '', modelType: '', type: '', cost: '' }); setEditingPreset(null); }}
                className={`px-4 py-2 capitalize font-medium ${newPresetCategory === cat ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <form onSubmit={handleSavePreset} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-8 bg-slate-50 p-4 rounded-lg border">
            <Input label="Brand" required value={presetForm.brand} onChange={e => setPresetForm({...presetForm, brand: e.target.value})} />
            
            {newPresetCategory === 'panels' && (
              <Input label="Wattage" required type="number" value={presetForm.modelType} onChange={e => setPresetForm({...presetForm, modelType: e.target.value})} />
            )}
            {newPresetCategory === 'inverters' && (
              <>
                <Input label="kW Size" required type="number" step="0.1" value={presetForm.modelType} onChange={e => setPresetForm({...presetForm, modelType: e.target.value})} />
                <Input label="Type" required placeholder="e.g. Hybrid" value={presetForm.type} onChange={e => setPresetForm({...presetForm, type: e.target.value})} />
              </>
            )}
            {newPresetCategory === 'batteries' && (
              <>
                <Input label="Model / Capacity" required value={presetForm.modelType} onChange={e => setPresetForm({...presetForm, modelType: e.target.value})} />
                <Input label="Type" required value={presetForm.type} onChange={e => setPresetForm({...presetForm, type: e.target.value})} />
              </>
            )}
            
            <Input label="Cost ($)" required type="number" step="0.01" value={presetForm.cost} onChange={e => setPresetForm({...presetForm, cost: e.target.value})} />
            <div className="mb-4">
              <Button type="submit" className="w-full">
                {editingPreset ? 'Update Preset' : 'Add Preset'}
              </Button>
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-sm">
                  <th className="p-3 font-medium">Brand</th>
                  <th className="p-3 font-medium">{newPresetCategory === 'panels' ? 'Wattage' : newPresetCategory === 'inverters' ? 'kW Size' : 'Model'}</th>
                  {(newPresetCategory === 'inverters' || newPresetCategory === 'batteries') && <th className="p-3 font-medium">Type</th>}
                  <th className="p-3 font-medium">Cost</th>
                  <th className="p-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {presets.filter(p => p.category === newPresetCategory).map(preset => (
                  <tr key={preset.id} className="border-b hover:bg-slate-50">
                    <td className="p-3">{preset.brand}</td>
                    <td className="p-3">{preset.modelType}{newPresetCategory === 'panels' ? 'W' : newPresetCategory === 'inverters' ? 'kW' : ''}</td>
                    {(newPresetCategory === 'inverters' || newPresetCategory === 'batteries') && <td className="p-3">{preset.type}</td>}
                    <td className="p-3">{formatMoney(preset.cost)}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => { setEditingPreset(preset.id); setPresetForm({ brand: preset.brand, modelType: preset.modelType, type: preset.type || '', cost: preset.cost }); }} className="text-blue-600 p-1 mr-2"><Edit className="w-4 h-4"/></button>
                      <button onClick={() => handleDeletePreset(preset.id)} className="text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                    </td>
                  </tr>
                ))}
                {presets.filter(p => p.category === newPresetCategory).length === 0 && (
                  <tr><td colSpan="5" className="p-4 text-center text-slate-500">No presets found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  };

  const DashboardTab = () => {
    const [scope, setScope] = useState('global'); // 'global' or owner id

    // Compute stats
    const filteredStock = useMemo(() => {
      if (scope === 'global') return stock;
      return stock.filter(s => s.ownerId === scope);
    }, [stock, scope]);

    const getStats = (category) => {
      const items = filteredStock.filter(s => s.category === category);
      const totalQty = items.reduce((sum, item) => sum + Number(item.quantity), 0);
      const totalValue = items.reduce((sum, item) => {
        const preset = presets.find(p => p.id === item.presetId);
        return sum + (preset ? preset.cost * item.quantity : 0);
      }, 0);
      return { totalQty, totalValue };
    };

    const panelsStats = getStats('panels');
    const invertersStats = getStats('inverters');
    const batteriesStats = getStats('batteries');

    // Grouping by model for tables
    const groupByCategory = (category) => {
      const items = filteredStock.filter(s => s.category === category);
      const groups = {};
      items.forEach(item => {
        if (!groups[item.presetId]) {
          groups[item.presetId] = { qty: 0, value: 0 };
        }
        groups[item.presetId].qty += Number(item.quantity);
        const preset = presets.find(p => p.id === item.presetId);
        if (preset) {
          groups[item.presetId].value += preset.cost * item.quantity;
        }
      });
      return Object.entries(groups).map(([presetId, data]) => ({
        preset: presets.find(p => p.id === presetId),
        ...data
      })).filter(g => g.preset && g.qty > 0);
    };

    const ownerSummary = useMemo(() => {
      if (scope !== 'global') return [];
      return owners.map(owner => {
        const ownerStock = stock.filter(s => s.ownerId === owner.id);
        const totalValue = ownerStock.reduce((sum, item) => {
          const preset = presets.find(p => p.id === item.presetId);
          return sum + (preset ? preset.cost * item.quantity : 0);
        }, 0);
        return { ...owner, totalValue };
      });
    }, [stock, owners, presets, scope]);

    const StatCard = ({ title, icon: Icon, qty, value, color }) => (
      <div className={`p-6 rounded-xl border flex items-center justify-between bg-white shadow-sm`}>
        <div>
          <p className="text-slate-500 font-medium mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-bold text-slate-800">{qty.toLocaleString()}</h3>
            <span className="text-sm text-slate-500">units</span>
          </div>
          <p className={`text-sm mt-1 font-semibold ${color}`}>{formatMoney(value)}</p>
        </div>
        <div className={`p-4 rounded-full ${color.replace('text-', 'bg-').replace('600', '100')} ${color}`}>
          <Icon className="w-8 h-8" />
        </div>
      </div>
    );

    const BreakdownTable = ({ title, data }) => (
      <Card className="flex-1">
        <h3 className="text-lg font-bold mb-4">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm">
                <th className="p-3 font-medium">Model</th>
                <th className="p-3 font-medium text-right">Quantity</th>
                <th className="p-3 font-medium text-right">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-3 font-medium text-slate-800">{getPresetName(row.preset)}</td>
                  <td className="p-3 text-right">{row.qty}</td>
                  <td className="p-3 text-right text-slate-600">{formatMoney(row.value)}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td colSpan="3" className="p-4 text-center text-slate-500">No stock available.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200 inline-flex">
          <button 
            onClick={() => setScope('global')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${scope === 'global' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Global
          </button>
          {owners.map(owner => (
            <button 
              key={owner.id}
              onClick={() => setScope(owner.id)}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${scope === owner.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {owner.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Total Panels" icon={Box} qty={panelsStats.totalQty} value={panelsStats.totalValue} color="text-blue-600" />
          <StatCard title="Total Inverters" icon={Cpu} qty={invertersStats.totalQty} value={invertersStats.totalValue} color="text-emerald-600" />
          <StatCard title="Total Batteries" icon={Battery} qty={batteriesStats.totalQty} value={batteriesStats.totalValue} color="text-amber-600" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <BreakdownTable title="Panels Breakdown" data={groupByCategory('panels')} />
          <BreakdownTable title="Inverters Breakdown" data={groupByCategory('inverters')} />
          <BreakdownTable title="Batteries Breakdown" data={groupByCategory('batteries')} />
        </div>

        {scope === 'global' && (
          <Card>
            <h3 className="text-lg font-bold mb-4">Owner Inventory Value</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {ownerSummary.map(owner => (
                <div key={owner.id} className="p-4 border rounded-lg bg-slate-50 text-center">
                  <p className="font-semibold text-slate-700">{owner.name}</p>
                  <p className="text-xl font-bold text-slate-900 mt-2">{formatMoney(owner.totalValue)}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    );
  };

  const AddStockTab = () => {
    const [batch, setBatch] = useState([]);
    const [draft, setDraft] = useState({
      category: 'panels',
      presetId: '',
      quantity: '',
      pallets: '',
      dateReceived: new Date().toISOString().split('T')[0],
      reference: '',
      ownerId: '',
      addGateway: true // Tesla logic
    });
    const [editingIndex, setEditingIndex] = useState(null);

    const activePresets = presets.filter(p => p.category === draft.category);
    const selectedPreset = presets.find(p => p.id === draft.presetId);
    
    // Tesla logic detection
    const isTesla = selectedPreset && selectedPreset.category === 'batteries' && 
                   (selectedPreset.modelType.includes('PW3') || selectedPreset.modelType.includes('Powerwall 3P'));

    const isDraftValid = draft.presetId && draft.quantity > 0 && draft.ownerId && draft.dateReceived;

    const handleAddOrUpdateBatch = () => {
      if (!isDraftValid) return;
      
      const newItem = { ...draft, id: Date.now().toString() };
      if (editingIndex !== null) {
        const newBatch = [...batch];
        newBatch[editingIndex] = newItem;
        setBatch(newBatch);
        setEditingIndex(null);
      } else {
        setBatch([...batch, newItem]);
      }
      
      // Reset mostly, keep some defaults
      setDraft(prev => ({
        ...prev,
        presetId: '',
        quantity: '',
        pallets: '',
        addGateway: true
      }));
    };

    const handleEditBatchItem = (index) => {
      setDraft(batch[index]);
      setEditingIndex(index);
    };

    const handleRemoveBatchItem = (index) => {
      setBatch(batch.filter((_, i) => i !== index));
    };

    const commitBatch = async () => {
      if (batch.length === 0) return;
      
      let gatewayPreset = presets.find(p => p.category === 'batteries' && p.modelType.includes('Tesla Gateway'));
      
      for (const item of batch) {
        const payload = {
          category: item.category,
          presetId: item.presetId,
          quantity: Number(item.quantity),
          ownerId: item.ownerId,
          dateReceived: item.dateReceived,
          reference: item.reference || ''
        };
        if (item.category === 'panels' && item.pallets) {
          payload.pallets = Number(item.pallets);
        }

        await addDoc(getColRef('stock'), payload);

        // Tesla Auto-Add Logic
        const itemPreset = presets.find(p => p.id === item.presetId);
        if (item.addGateway && itemPreset && (itemPreset.modelType.includes('PW3') || itemPreset.modelType.includes('Powerwall 3P'))) {
          // Ensure gateway preset exists
          if (!gatewayPreset) {
            const docRef = await addDoc(getColRef('presets'), {
              category: 'batteries',
              brand: 'Tesla',
              modelType: 'Tesla Gateway',
              type: 'Accessory',
              cost: 2000
            });
            gatewayPreset = { id: docRef.id };
          }
          
          await addDoc(getColRef('stock'), {
            category: 'batteries',
            presetId: gatewayPreset.id,
            quantity: Number(item.quantity),
            ownerId: item.ownerId,
            dateReceived: item.dateReceived,
            reference: item.reference || ''
          });
        }
      }
      
      await addDoc(getColRef('logs'), {
        date: new Date().toISOString(),
        type: 'STOCK_IN',
        details: `Added ${batch.length} batch(es) to inventory.`
      });

      setBatch([]);
      alert("Batch committed successfully!");
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <h2 className="text-xl font-bold mb-6">Queue New Stock</h2>
          
          <Select label="Category" value={draft.category} onChange={e => setDraft({...draft, category: e.target.value, presetId: ''})}>
            <option value="panels">Solar Panels</option>
            <option value="inverters">Inverters</option>
            <option value="batteries">Batteries</option>
          </Select>
          
          <Select label="Item Model" value={draft.presetId} onChange={e => setDraft({...draft, presetId: e.target.value})}>
            <option value="">-- Select Model --</option>
            {activePresets.map(p => (
              <option key={p.id} value={p.id}>{getPresetName(p)}</option>
            ))}
          </Select>

          {selectedPreset && (
            <div className="bg-slate-50 p-3 rounded-lg mb-4 text-sm text-slate-600 border">
              <p><strong>Brand:</strong> {selectedPreset.brand}</p>
              <p><strong>Specs:</strong> {selectedPreset.modelType} {selectedPreset.type ? `(${selectedPreset.type})` : ''}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Quantity" type="number" required min="1" value={draft.quantity} onChange={e => setDraft({...draft, quantity: e.target.value})} />
            {draft.category === 'panels' && (
              <Input label="Pallets" type="number" min="0" value={draft.pallets} onChange={e => setDraft({...draft, pallets: e.target.value})} />
            )}
          </div>

          <Input label="Date Received" type="date" required value={draft.dateReceived} onChange={e => setDraft({...draft, dateReceived: e.target.value})} />
          <Input label="Reference (PO/Shipment)" value={draft.reference} onChange={e => setDraft({...draft, reference: e.target.value})} />
          
          <Select label="Allocate to Owner" value={draft.ownerId} onChange={e => setDraft({...draft, ownerId: e.target.value})}>
            <option value="">-- Select Owner --</option>
            {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>

          {isTesla && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <input 
                type="checkbox" 
                id="tesla-gate" 
                className="mt-1" 
                checked={draft.addGateway} 
                onChange={(e) => setDraft({...draft, addGateway: e.target.checked})} 
              />
              <label htmlFor="tesla-gate" className="text-sm text-blue-900 font-medium cursor-pointer">
                Add 1x Tesla Gateway per Powerwall to this batch.
              </label>
            </div>
          )}

          <Button 
            className="w-full" 
            disabled={!isDraftValid} 
            onClick={handleAddOrUpdateBatch}
          >
            {editingIndex !== null ? 'Update Item in Batch' : 'Add to Staging Batch'}
          </Button>
          {!isDraftValid && <p className="text-xs text-red-500 mt-2 text-center">Please fill all required fields.</p>}
        </Card>

        <Card className="lg:col-span-2 flex flex-col">
          <h2 className="text-xl font-bold mb-6 flex items-center justify-between">
            <span>Staging Batch ({batch.length})</span>
            {batch.length > 0 && (
              <Button onClick={commitBatch} variant="primary">
                Commit Stock to Database <CheckCircle className="w-4 h-4" />
              </Button>
            )}
          </h2>
          
          {batch.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
              <Box className="w-16 h-16 mb-4 opacity-20" />
              <p>Your staging area is empty.</p>
              <p className="text-sm mt-2 text-center">Add items from the form on the left to build a batch before committing to inventory.</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-sm">
                    <th className="p-3">Item</th>
                    <th className="p-3">Qty</th>
                    <th className="p-3">Owner</th>
                    <th className="p-3">Ref / Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.map((item, index) => {
                    const preset = presets.find(p => p.id === item.presetId);
                    const owner = owners.find(o => o.id === item.ownerId);
                    const hasGateway = item.addGateway && preset?.modelType.includes('PW3');
                    return (
                      <tr key={item.id} className="border-b">
                        <td className="p-3">
                          <div className="font-medium text-slate-800">{getPresetName(preset)}</div>
                          {hasGateway && <div className="text-xs text-blue-600">+ {item.quantity}x Tesla Gateway</div>}
                        </td>
                        <td className="p-3">{item.quantity} {item.pallets ? `(${item.pallets} pallets)` : ''}</td>
                        <td className="p-3">{owner?.name}</td>
                        <td className="p-3 text-sm">
                          <div>{item.reference || 'No Ref'}</div>
                          <div className="text-slate-500">{item.dateReceived}</div>
                        </td>
                        <td className="p-3 text-right flex justify-end gap-2">
                          <button onClick={() => handleEditBatchItem(index)} className="text-blue-600 p-1"><Edit className="w-4 h-4"/></button>
                          <button onClick={() => handleRemoveBatchItem(index)} className="text-red-600 p-1"><Trash2 className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  };

  const AllStockTab = () => {
    const [filterOwner, setFilterOwner] = useState('');
    const [transferModal, setTransferModal] = useState({ open: false, stockItem: null, toOwner: '' });

    const displayedStock = filterOwner ? stock.filter(s => s.ownerId === filterOwner) : stock;
    const sortedStock = [...displayedStock].sort((a,b) => new Date(b.dateReceived) - new Date(a.dateReceived));

    const handleTransfer = async () => {
      const { stockItem, toOwner } = transferModal;
      if (!toOwner || stockItem.ownerId === toOwner) return;

      const fromOwnerName = owners.find(o => o.id === stockItem.ownerId)?.name;
      const toOwnerName = owners.find(o => o.id === toOwner)?.name;
      const preset = presets.find(p => p.id === stockItem.presetId);

      await updateDoc(getDocRef('stock', stockItem.id), { ownerId: toOwner });
      
      await addDoc(getColRef('logs'), {
        date: new Date().toISOString(),
        type: 'TRANSFER',
        details: `Transferred ${stockItem.quantity}x ${getPresetName(preset)} from ${fromOwnerName} to ${toOwnerName}`
      });

      setTransferModal({ open: false, stockItem: null, toOwner: '' });
    };

    const handleRemoveStock = async (item) => {
      if (window.confirm('Are you sure you want to permanently delete this stock record?')) {
        await deleteDoc(getDocRef('stock', item.id));
        await addDoc(getColRef('logs'), {
          date: new Date().toISOString(),
          type: 'DELETE',
          details: `Deleted record of ${item.quantity}x items from ${owners.find(o=>o.id===item.ownerId)?.name}`
        });
      }
    };

    return (
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="text-xl font-bold">Inventory Log</h2>
          <Select label="" value={filterOwner} onChange={e => setFilterOwner(e.target.value)} className="mb-0 min-w-[200px]">
            <option value="">All Owners</option>
            {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-sm">
                <th className="p-3">Date</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Category</th>
                <th className="p-3">Item Specs</th>
                <th className="p-3">Owner</th>
                <th className="p-3 text-right">Quantity</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedStock.map(item => {
                const preset = presets.find(p => p.id === item.presetId);
                const owner = owners.find(o => o.id === item.ownerId);
                return (
                  <tr key={item.id} className="border-b hover:bg-slate-50">
                    <td className="p-3 text-sm">{item.dateReceived}</td>
                    <td className="p-3 text-sm">{item.reference || '-'}</td>
                    <td className="p-3 text-sm capitalize">{item.category}</td>
                    <td className="p-3 font-medium text-slate-800">{getPresetName(preset)}</td>
                    <td className="p-3">{owner?.name}</td>
                    <td className="p-3 text-right font-bold">
                      {item.quantity}
                      {item.pallets ? <span className="block text-xs font-normal text-slate-500">({item.pallets} p)</span> : null}
                    </td>
                    <td className="p-3 text-right">
                      <button 
                        onClick={() => setTransferModal({ open: true, stockItem: item, toOwner: '' })}
                        className="text-emerald-600 p-2 hover:bg-emerald-50 rounded" title="Transfer to another owner"
                      >
                        <ArrowRightLeft className="w-4 h-4"/>
                      </button>
                      <button 
                        onClick={() => handleRemoveStock(item)}
                        className="text-red-600 p-2 hover:bg-red-50 rounded" title="Delete record"
                      >
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sortedStock.length === 0 && <tr><td colSpan="7" className="p-4 text-center text-slate-500">No records found.</td></tr>}
            </tbody>
          </table>
        </div>

        {transferModal.open && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4">Transfer Stock</h3>
              <p className="mb-4 text-slate-600">
                Transferring <strong>{transferModal.stockItem.quantity}x {getPresetName(presets.find(p => p.id === transferModal.stockItem.presetId))}</strong>
              </p>
              <Select label="Select New Owner" value={transferModal.toOwner} onChange={e => setTransferModal({...transferModal, toOwner: e.target.value})}>
                <option value="">-- Choose --</option>
                {owners.filter(o => o.id !== transferModal.stockItem.ownerId).map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </Select>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="secondary" onClick={() => setTransferModal({ open: false, stockItem: null, toOwner: '' })}>Cancel</Button>
                <Button onClick={handleTransfer} disabled={!transferModal.toOwner}>Confirm Transfer</Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  const JobsTab = () => {
    const [jobDraft, setJobDraft] = useState({ ownerId: '', items: [], reference: '' });
    const [newItem, setNewItem] = useState({ presetId: '', quantity: '' });

    const selectedOwnerId = jobDraft.ownerId;
    
    // Calculate available stock for the selected owner
    const availableStockMap = useMemo(() => {
      if (!selectedOwnerId) return {};
      const map = {};
      stock.filter(s => s.ownerId === selectedOwnerId).forEach(item => {
        if (!map[item.presetId]) map[item.presetId] = 0;
        map[item.presetId] += Number(item.quantity);
      });
      return map;
    }, [stock, selectedOwnerId]);

    const handleAddItemToJob = () => {
      const qty = Number(newItem.quantity);
      if (!newItem.presetId || qty <= 0) return;
      
      const available = availableStockMap[newItem.presetId] || 0;
      // Also account for what's already in the job draft
      const alreadyDrafted = jobDraft.items.filter(i => i.presetId === newItem.presetId).reduce((s, i) => s + i.quantity, 0);
      
      if (qty + alreadyDrafted > available) {
        alert(`Insufficient stock. You only have ${available - alreadyDrafted} left to allocate.`);
        return;
      }

      setJobDraft(prev => ({
        ...prev,
        items: [...prev.items, { presetId: newItem.presetId, quantity: qty }]
      }));
      setNewItem({ presetId: '', quantity: '' });
    };

    const handleSubmitJob = async () => {
      if (!jobDraft.ownerId || jobDraft.items.length === 0) return;

      const ownerName = owners.find(o => o.id === jobDraft.ownerId)?.name;
      const jobDate = new Date().toISOString();

      try {
        // FIFO Stock Deduction Process
        for (const reqItem of jobDraft.items) {
          let qtyRemainingToDeduct = reqItem.quantity;
          
          // Get all stock records for this preset & owner, sort oldest first
          const records = stock
            .filter(s => s.ownerId === jobDraft.ownerId && s.presetId === reqItem.presetId)
            .sort((a,b) => new Date(a.dateReceived) - new Date(b.dateReceived));

          for (const rec of records) {
            if (qtyRemainingToDeduct <= 0) break;

            if (rec.quantity <= qtyRemainingToDeduct) {
              // Deduct entire record
              qtyRemainingToDeduct -= rec.quantity;
              await deleteDoc(getDocRef('stock', rec.id));
            } else {
              // Deduct partial record
              await updateDoc(getDocRef('stock', rec.id), {
                quantity: rec.quantity - qtyRemainingToDeduct
              });
              qtyRemainingToDeduct = 0;
            }
          }
          
          if (qtyRemainingToDeduct > 0) {
            console.warn(`Critical: Not enough stock to fully satisfy FIFO for ${reqItem.presetId}`);
          }
        }

        // Save Job Record
        await addDoc(getColRef('jobs'), {
          date: jobDate,
          ownerId: jobDraft.ownerId,
          items: jobDraft.items,
          reference: jobDraft.reference || 'N/A'
        });
        
        await addDoc(getColRef('logs'), {
          date: jobDate,
          type: 'JOB_OUT',
          details: `Job created for ${ownerName}. Items used: ${jobDraft.items.length}`
        });

        alert("Job submitted and stock deducted successfully!");
        setJobDraft({ ownerId: '', items: [], reference: '' });

      } catch (err) {
        console.error(err);
        alert("An error occurred while processing the job.");
      }
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-xl font-bold mb-6">Create Outgoing Job</h2>
          
          <Select 
            label="Business Owner" 
            value={jobDraft.ownerId} 
            onChange={e => setJobDraft({ ownerId: e.target.value, items: [], reference: '' })}
          >
            <option value="">-- Select Owner --</option>
            {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>

          {jobDraft.ownerId && (
            <>
              <Input 
                label="Job Reference / Address" 
                value={jobDraft.reference} 
                onChange={e => setJobDraft({...jobDraft, reference: e.target.value})} 
              />
              
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6">
                <h4 className="font-semibold mb-3 text-sm">Add Items from Stock</h4>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={newItem.presetId} onChange={e => setNewItem({...newItem, presetId: e.target.value})} className="mb-0">
                      <option value="">- Select Item -</option>
                      {Object.entries(availableStockMap).map(([pid, qty]) => {
                        const p = presets.find(pr => pr.id === pid);
                        return <option key={pid} value={pid}>{getPresetName(p)} (Available: {qty})</option>
                      })}
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input 
                      type="number" min="1" placeholder="Qty" value={newItem.quantity} 
                      onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                      className="mb-0"
                    />
                  </div>
                  <Button onClick={handleAddItemToJob} type="button" variant="secondary"><Plus className="w-5 h-5"/></Button>
                </div>
              </div>

              <div className="mb-6 border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr><th className="text-left p-2">Item</th><th className="text-right p-2">Qty</th></tr>
                  </thead>
                  <tbody>
                    {jobDraft.items.map((it, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{getPresetName(presets.find(p=>p.id === it.presetId))}</td>
                        <td className="p-2 text-right">{it.quantity}</td>
                      </tr>
                    ))}
                    {jobDraft.items.length === 0 && <tr><td colSpan="2" className="p-2 text-center text-slate-500">No items added yet</td></tr>}
                  </tbody>
                </table>
              </div>
              
              <Button 
                className="w-full" 
                disabled={jobDraft.items.length === 0} 
                onClick={handleSubmitJob}
              >
                Submit Job & Deduct Stock
              </Button>
            </>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-bold mb-6">Recent Jobs</h2>
          <div className="space-y-4">
            {jobs.map(job => {
              const owner = owners.find(o => o.id === job.ownerId);
              return (
                <div key={job.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-slate-800">{owner?.name}</span>
                      <p className="text-sm text-slate-500">Ref: {job.reference}</p>
                    </div>
                    <span className="text-xs text-slate-400">{new Date(job.date).toLocaleDateString()}</span>
                  </div>
                  <ul className="text-sm text-slate-700 list-disc pl-4 mt-2 border-t pt-2 border-slate-200">
                    {job.items.map((it, i) => (
                      <li key={i}>{it.quantity}x {getPresetName(presets.find(p=>p.id === it.presetId))}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {jobs.length === 0 && <p className="text-slate-500 text-center py-6">No jobs recorded yet.</p>}
          </div>
        </Card>
      </div>
    );
  };

  if (loading && !user) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-lg font-medium text-slate-600 animate-pulse">Initializing Database...</p></div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-red-500">{error}</p></div>;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'add-stock', label: 'Add Stock', icon: PackagePlus },
    { id: 'all-stock', label: 'All Stock', icon: List },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'admin', label: 'Admin & Presets', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b flex items-center justify-between p-4 sticky top-0 z-20">
        <div className="flex items-center gap-2 font-bold text-blue-600 text-lg">
          <Box className="w-6 h-6" /> Solar Stock Manager
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-600">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-10 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 hidden md:flex items-center gap-2 font-bold text-blue-600 text-xl border-b">
          <Box className="w-6 h-6" /> Stock Manager
        </div>
        <nav className="p-4 space-y-2">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium text-left
                  ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                {item.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          <header className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              {navItems.find(i => i.id === activeTab)?.label}
            </h1>
          </header>

          <main>
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'add-stock' && <AddStockTab />}
            {activeTab === 'all-stock' && <AllStockTab />}
            {activeTab === 'jobs' && <JobsTab />}
            {activeTab === 'admin' && <AdminTab />}
          </main>
        </div>
      </div>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/20 z-0 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>
  );
}