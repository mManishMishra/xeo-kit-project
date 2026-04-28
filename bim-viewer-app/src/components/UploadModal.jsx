import { useRef } from 'react';
import { X, FileBox } from 'lucide-react';

const UploadModal = ({ isOpen, onClose, onFileUpload }) => {
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileUpload(file);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-2xl mx-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/40 dark:border-slate-700/50 shadow-[0_0_80px_rgba(0,0,0,0.2)] dark:shadow-[0_0_80px_rgba(0,0,0,0.5)] rounded-[2rem] p-10 animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
        
        {/* Decorative background gradients */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/20 blur-3xl rounded-full pointer-events-none"></div>

        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors z-10">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-10 relative z-10">
          <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500 dark:from-indigo-400 dark:to-cyan-400 mb-3">
            XeoVision Pro
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-lg">Initialize your BIM environment</p>
        </div>

        {/* Drag & Drop Zone */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="relative group border-2 border-dashed border-indigo-300/50 dark:border-indigo-500/30 rounded-3xl p-12 flex flex-col items-center justify-center bg-indigo-50/30 dark:bg-indigo-900/10 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/30 transition-all duration-300 cursor-pointer overflow-hidden"
        >
          {/* Animated glow on hover */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

          <div className="w-20 h-20 mb-6 rounded-2xl bg-white dark:bg-slate-800 shadow-xl flex items-center justify-center group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500">
            <FileBox className="w-10 h-10 text-indigo-500 dark:text-indigo-400" />
          </div>
          
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-full font-semibold shadow-[0_8px_30px_rgb(99,102,241,0.3)] transition-all transform mb-4 pointer-events-none relative z-10">
            Select 3D Model
          </button>
          
          <p className="text-slate-600 dark:text-slate-300 font-medium mb-2 relative z-10">Click or Drag & Drop files here</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center relative z-10">
            Supported formats: <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400">.xkt</span> <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400">.ifc</span>
          </p>
          
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept=".xkt,.ifc" />
        </div>
      </div>
    </div>
  );
};

export default UploadModal;