import React, { useState, useEffect } from 'react';
import { Calculator, Users, Euro, FileText, Download, Upload, Plus, Edit, Trash2, X, Clock, Calendar } from 'lucide-react';
import jsPDF from 'jspdf';

// Types
interface Profile {
  id: string;
  name: string;
  hourlyRate: number;
  deductionType: 'Uurloon' | 'Marge';
  deductions: Deduction[];
  createdAt: Date;
  updatedAt: Date;
}

interface Deduction {
  id: string;
  name: string;
  amount: number;
  type: 'percentage' | 'fixed';
  priority: number;
}

interface HoursEntry {
  id: string;
  profileId: string;
  date: Date;
  hours: number;
  description?: string;
}

interface CalculationResult {
  profileId: string;
  profileName: string;
  totalHours: number;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  deductionBreakdown: DeductionBreakdown[];
}

interface DeductionBreakdown {
  deductionId: string;
  deductionName: string;
  amount: number;
  type: 'percentage' | 'fixed';
}

interface ClientPayment {
  totalAmount: number;
  totalHours: number;
  averageRate: number;
}

interface PaymentDistribution {
  profileId: string;
  profileName: string;
  amount: number;
  percentage: number;
}

function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hoursEntries, setHoursEntries] = useState<HoursEntry[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [calculations, setCalculations] = useState<CalculationResult[]>([]);
  const [clientPayment, setClientPayment] = useState<ClientPayment>({
    totalAmount: 0,
    totalHours: 0,
    averageRate: 0,
  });
  const [paymentDistribution, setPaymentDistribution] = useState<PaymentDistribution[]>([]);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    hourlyRate: 0,
    deductionType: 'Uurloon' as 'Uurloon' | 'Marge',
    deductions: [] as Omit<Deduction, 'id'>[],
  });

  // Hours form state
  const [hoursForm, setHoursForm] = useState({
    profileId: '',
    hours: 0,
    description: '',
  });

  // Load data from localStorage on app start
  useEffect(() => {
    const savedProfiles = localStorage.getItem('urenregistratie-profiles');
    const savedHours = localStorage.getItem('urenregistratie-hours');
    
    if (savedProfiles) {
      try {
        const parsedProfiles = JSON.parse(savedProfiles).map((profile: any) => ({
          ...profile,
          createdAt: new Date(profile.createdAt),
          updatedAt: new Date(profile.updatedAt),
        }));
        setProfiles(parsedProfiles);
      } catch (error) {
        console.error('Error loading profiles:', error);
      }
    }
    
    if (savedHours) {
      try {
        const parsedHours = JSON.parse(savedHours).map((entry: any) => ({
          ...entry,
          date: new Date(entry.date),
        }));
        setHoursEntries(parsedHours);
      } catch (error) {
        console.error('Error loading hours:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever profiles or hours change
  useEffect(() => {
    if (profiles.length > 0) {
      localStorage.setItem('urenregistratie-profiles', JSON.stringify(profiles));
    }
  }, [profiles]);

  useEffect(() => {
    if (hoursEntries.length > 0) {
      localStorage.setItem('urenregistratie-hours', JSON.stringify(hoursEntries));
    }
  }, [hoursEntries]);

  // Calculate totals whenever data changes
  useEffect(() => {
    calculateTotals();
  }, [profiles, hoursEntries]);

  const calculateTotals = () => {
    // Group hours by profile
    const profileHours = hoursEntries.reduce((acc, entry) => {
      if (!acc[entry.profileId]) {
        acc[entry.profileId] = 0;
      }
      acc[entry.profileId] += entry.hours;
      return acc;
    }, {} as Record<string, number>);

    // Calculate results for each profile
    const results: CalculationResult[] = profiles.map(profile => {
      const totalHours = profileHours[profile.id] || 0;
      const grossAmount = totalHours * profile.hourlyRate;
      
      // Calculate deductions (prioritize Uurloon before Marge)
      let totalDeductions = 0;
      const deductionBreakdown = profile.deductions
        .sort((a, b) => a.priority - b.priority)
        .map(deduction => {
          const amount = deduction.type === 'percentage' 
            ? (grossAmount * deduction.amount) / 100
            : deduction.amount;
          totalDeductions += amount;
          return {
            deductionId: deduction.id,
            deductionName: deduction.name,
            amount,
            type: deduction.type,
          };
        });

      return {
        profileId: profile.id,
        profileName: profile.name,
        totalHours,
        grossAmount,
        totalDeductions,
        netAmount: grossAmount - totalDeductions,
        deductionBreakdown,
      };
    });

    setCalculations(results);

    // Calculate client payment
    const totalAmount = results.reduce((sum, result) => sum + result.grossAmount, 0);
    const totalHours = results.reduce((sum, result) => sum + result.totalHours, 0);
    const averageRate = totalHours > 0 ? totalAmount / totalHours : 0;

    setClientPayment({
      totalAmount,
      totalHours,
      averageRate,
    });

    // Calculate payment distribution
    const distribution: PaymentDistribution[] = results.map(result => ({
      profileId: result.profileId,
      profileName: result.profileName,
      amount: result.netAmount,
      percentage: totalAmount > 0 ? (result.netAmount / totalAmount) * 100 : 0,
    }));

    setPaymentDistribution(distribution);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)} uur`;
  };

  const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  const handleAddProfile = () => {
    setEditingProfile(null);
    setProfileForm({
      name: '',
      hourlyRate: 0,
      deductionType: 'Uurloon',
      deductions: [],
    });
    setIsProfileModalOpen(true);
  };

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setProfileForm({
      name: profile.name,
      hourlyRate: profile.hourlyRate,
      deductionType: profile.deductionType,
      deductions: profile.deductions.map(d => ({
        name: d.name,
        amount: d.amount,
        type: d.type,
        priority: d.priority,
      })),
    });
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = () => {
    if (!profileForm.name.trim() || profileForm.hourlyRate <= 0) {
      alert('Vul alle verplichte velden in');
      return;
    }

    const newProfile: Profile = {
      id: editingProfile?.id || generateId(),
      name: profileForm.name.trim(),
      hourlyRate: profileForm.hourlyRate,
      deductionType: profileForm.deductionType,
      deductions: profileForm.deductions.map((d, index) => ({
        id: generateId(),
        ...d,
        priority: index,
      })),
      createdAt: editingProfile?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (editingProfile) {
      setProfiles(profiles.map(p => p.id === editingProfile.id ? newProfile : p));
    } else {
      setProfiles([...profiles, newProfile]);
    }

    setIsProfileModalOpen(false);
    setEditingProfile(null);
  };

  const handleDeleteProfile = (profileId: string) => {
    if (confirm('Weet je zeker dat je dit profiel wilt verwijderen?')) {
      const newProfiles = profiles.filter(p => p.id !== profileId);
      const newHoursEntries = hoursEntries.filter(h => h.profileId !== profileId);
      
      setProfiles(newProfiles);
      setHoursEntries(newHoursEntries);
      
      // Update localStorage
      if (newProfiles.length === 0) {
        localStorage.removeItem('urenregistratie-profiles');
      } else {
        localStorage.setItem('urenregistratie-profiles', JSON.stringify(newProfiles));
      }
      
      if (newHoursEntries.length === 0) {
        localStorage.removeItem('urenregistratie-hours');
      } else {
        localStorage.setItem('urenregistratie-hours', JSON.stringify(newHoursEntries));
      }
    }
  };

  const addDeduction = () => {
    setProfileForm({
      ...profileForm,
      deductions: [
        ...profileForm.deductions,
        {
          name: '',
          amount: 0,
          type: 'percentage',
          priority: profileForm.deductions.length,
        },
      ],
    });
  };

  const removeDeduction = (index: number) => {
    setProfileForm({
      ...profileForm,
      deductions: profileForm.deductions.filter((_, i) => i !== index),
    });
  };

  const updateDeduction = (index: number, field: string, value: any) => {
    const newDeductions = [...profileForm.deductions];
    newDeductions[index] = { ...newDeductions[index], [field]: value };
    setProfileForm({ ...profileForm, deductions: newDeductions });
  };

  // Hours management functions
  const handleAddHours = () => {
    if (profiles.length === 0) {
      alert('Voeg eerst een profiel toe');
      return;
    }
    setHoursForm({
      profileId: profiles[0].id,
      hours: 0,
      description: '',
    });
    setIsHoursModalOpen(true);
  };

  const handleSaveHours = () => {
    if (!hoursForm.profileId || hoursForm.hours <= 0) {
      alert('Selecteer een profiel en voer geldige uren in');
      return;
    }

    const newHoursEntry: HoursEntry = {
      id: generateId(),
      profileId: hoursForm.profileId,
      date: new Date(selectedDate),
      hours: hoursForm.hours,
      description: hoursForm.description.trim() || undefined,
    };

    setHoursEntries([...hoursEntries, newHoursEntry]);
    setIsHoursModalOpen(false);
    setHoursForm({
      profileId: '',
      hours: 0,
      description: '',
    });
  };


  const getHoursForDate = (date: string) => {
    return hoursEntries.filter(entry => 
      entry.date.toISOString().split('T')[0] === date
    );
  };

  // PDF Export functions
  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Helper function to draw a line
    const drawLine = (y: number) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(20, y, pageWidth - 20, y);
    };

    // Helper function to draw table with proper cells
    const drawTable = (x: number, y: number, colWidths: number[], rowHeights: number[], data: string[][], isHeaderBold: boolean = false) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      
      const totalWidth = colWidths.reduce((sum, width) => sum + width, 0);
      const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0);
      
      // Draw outer border
      doc.rect(x, y, totalWidth, totalHeight);
      
      // Draw vertical lines between columns
      let currentX = x;
      for (let i = 0; i < colWidths.length - 1; i++) {
        currentX += colWidths[i];
        doc.line(currentX, y, currentX, y + totalHeight);
      }
      
      // Draw horizontal lines between rows
      let currentY = y;
      for (let i = 0; i < rowHeights.length - 1; i++) {
        currentY += rowHeights[i];
        doc.line(x, currentY, x + totalWidth, currentY);
      }
      
      // Add text to cells with proper centering
      currentY = y;
      data.forEach((row, rowIndex) => {
        currentX = x;
        
        // Set font style for header row
        if (rowIndex === 0 && isHeaderBold) {
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }
        
        row.forEach((cellText, colIndex) => {
          const cellWidth = colWidths[colIndex];
          const cellHeight = rowHeights[rowIndex];
          
          // Calculate center position for text
          const cellCenterX = currentX + (cellWidth / 2);
          const cellCenterY = currentY + (cellHeight / 2) + 2; // +2 for better vertical centering
          
          // Center all text in cells
          doc.text(cellText, cellCenterX, cellCenterY, { align: 'center' });
          
          currentX += cellWidth;
        });
        currentY += rowHeights[rowIndex];
      });
    };

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Urenregistratie Rapport', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gegenereerd op: ${new Date().toLocaleDateString('nl-NL')} om ${new Date().toLocaleTimeString('nl-NL')}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;

    // Summary section
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Samenvatting', 20, yPosition);
    yPosition += 15;

    // Summary table
    const summaryData = [
      ['Totaal Uren', formatHours(clientPayment.totalHours)],
      ['Klant Betaalt', formatCurrency(clientPayment.totalAmount)],
      ['Gemiddeld Tarief', formatCurrency(clientPayment.averageRate)],
      ['Aantal Profielen', calculations.length.toString()]
    ];

    // Draw summary table with proper cells
    const summaryTableY = yPosition;
    const summaryColWidths = [90, 70];
    const summaryRowHeights = [15, 15, 15, 15];
    
    doc.setFontSize(11);
    drawTable(20, summaryTableY, summaryColWidths, summaryRowHeights, summaryData);
    yPosition += (summaryRowHeights.reduce((sum, height) => sum + height, 0)) + 25;

    // Profiles section
    if (calculations.length > 0) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Profielen & Uren Overzicht', 20, yPosition);
      yPosition += 15;

      // Prepare table data
      const headers = ['Naam', 'Uren', 'Tarief', 'Bruto', 'Aftrek', 'Netto'];
      const colWidths = [40, 25, 30, 30, 30, 30];
      const rowHeight = 15;
      
      // Create table data with headers and rows
      const tableData = [headers];
      calculations.forEach((calc) => {
        const rowData = [
          calc.profileName,
          formatHours(calc.totalHours),
          formatCurrency(profiles.find(p => p.id === calc.profileId)?.hourlyRate || 0),
          formatCurrency(calc.grossAmount),
          formatCurrency(calc.totalDeductions),
          formatCurrency(calc.netAmount)
        ];
        tableData.push(rowData);
      });
      
      // Create row heights array
      const rowHeights = Array(tableData.length).fill(rowHeight);
      
      // Draw table with proper cells
      doc.setFontSize(10);
      drawTable(20, yPosition, colWidths, rowHeights, tableData, true);
      yPosition += (rowHeights.reduce((sum, height) => sum + height, 0)) + 20;
    }

    // Daily breakdown
    if (hoursEntries.length > 0) {
      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Dagelijkse Uren Overzicht', 20, yPosition);
      yPosition += 15;

      // Prepare daily table data
      const dailyHeaders = ['Datum', 'Uren', 'Profielen', 'Totaal'];
      const dailyColWidths = [45, 25, 45, 35];
      const dailyRowHeight = 15;
      
      const dailyEntries = Array.from(new Set(hoursEntries.map(entry => entry.date.toISOString().split('T')[0])))
        .sort()
        .reverse();
      
      // Create table data with headers and rows
      const dailyTableData = [dailyHeaders];
      dailyEntries.forEach((date) => {
        const dayEntries = getHoursForDate(date);
        const totalHours = dayEntries.reduce((sum, entry) => sum + entry.hours, 0);
        const uniqueProfiles = new Set(dayEntries.map(entry => entry.profileId)).size;
        
        const rowData = [
          new Date(date).toLocaleDateString('nl-NL'),
          formatHours(totalHours),
          `${uniqueProfiles} profiel${uniqueProfiles !== 1 ? 'en' : ''}`,
          formatCurrency(totalHours * clientPayment.averageRate)
        ];
        dailyTableData.push(rowData);
      });
      
      // Create row heights array
      const dailyRowHeights = Array(dailyTableData.length).fill(dailyRowHeight);
      
      // Draw table with proper cells
      doc.setFontSize(10);
      drawTable(20, yPosition, dailyColWidths, dailyRowHeights, dailyTableData, true);
      yPosition += (dailyRowHeights.reduce((sum, height) => sum + height, 0)) + 20;
    }

    // Footer
    const footerY = pageHeight - 20;
    drawLine(footerY - 5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Urenregistratie Calculator - Professioneel rapport', pageWidth / 2, footerY, { align: 'center' });

    // Save the PDF
    doc.save(`urenregistratie-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportData = () => {
    const exportData = {
      profiles,
      hoursEntries,
      calculations,
      clientPayment,
      paymentDistribution,
      exportDate: new Date(),
      version: '1.0'
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `urenregistratie-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.profiles) {
          const importedProfiles = data.profiles.map((profile: any) => ({
            ...profile,
            createdAt: new Date(profile.createdAt),
            updatedAt: new Date(profile.updatedAt),
          }));
          setProfiles(importedProfiles);
        }
        
        if (data.hoursEntries) {
          const importedHours = data.hoursEntries.map((entry: any) => ({
            ...entry,
            date: new Date(entry.date),
          }));
          setHoursEntries(importedHours);
        }
        
        alert('Data succesvol geïmporteerd!');
      } catch (error) {
        alert('Fout bij importeren van data. Controleer of het bestand geldig is.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 rounded-xl">
                <Calculator className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">Urenregistratie Calculator</h1>
                <p className="text-sm text-slate-500">Professionele uren- en betalingscalculator</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <label className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500 cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={importData}
                  className="hidden"
                />
              </label>
              <button
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500"
                onClick={exportData}
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </button>
              <button
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-danger-600 text-white shadow-soft hover:bg-danger-700 hover:shadow-medium focus:ring-danger-500 active:scale-95"
                onClick={generatePDF}
                disabled={calculations.length === 0}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export PDF
              </button>
              <button
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-success-600 text-white shadow-soft hover:bg-success-700 hover:shadow-medium focus:ring-success-500 active:scale-95"
                onClick={handleAddHours}
                disabled={profiles.length === 0}
              >
                <Clock className="h-4 w-4 mr-2" />
                Uren Toevoegen
              </button>
              <button
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary-600 text-white shadow-soft hover:bg-primary-700 hover:shadow-medium focus:ring-primary-500 active:scale-95"
                onClick={handleAddProfile}
              >
                <Users className="h-4 w-4 mr-2" />
                Profielen
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        {/* Top Section - Client Payment & Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Client Payment Card */}
          <div className="bg-white rounded-2xl shadow-medium border border-slate-200/50 overflow-hidden">
            <div className="flex flex-col space-y-1.5 pb-4 p-6">
              <h3 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center space-x-2">
                <Euro className="h-5 w-5 text-success-600" />
                <span>Klant Betaalt</span>
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-bold text-slate-900 mb-2">
                    {formatCurrency(clientPayment.totalAmount)}
                  </div>
                  <div className="text-sm text-slate-500">
                    Totaal voor {formatHours(clientPayment.totalHours)}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-slate-900">
                      {formatHours(clientPayment.totalHours)}
                    </div>
                    <div className="text-xs text-slate-500">Totaal uren</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-slate-900">
                      {formatCurrency(clientPayment.averageRate)}
                    </div>
                    <div className="text-xs text-slate-500">Gemiddeld tarief</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Distribution Card */}
          <div className="bg-white rounded-2xl shadow-medium border border-slate-200/50 overflow-hidden">
            <div className="flex flex-col space-y-1.5 pb-4 p-6">
              <h3 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center space-x-2">
                <FileText className="h-5 w-5 text-primary-600" />
                <span>Uitbetalingen</span>
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {paymentDistribution.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">Geen profielen toegevoegd</p>
                  </div>
                ) : (
                  paymentDistribution.map((payment) => (
                    <div key={payment.profileId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div>
                        <div className="font-medium text-slate-900">{payment.profileName}</div>
                        <div className="text-xs text-slate-500">{payment.percentage.toFixed(1)}%</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(payment.amount)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Daily Hours Overview */}
        {hoursEntries.length > 0 && (
          <div className="bg-white rounded-2xl shadow-medium border border-slate-200/50 overflow-hidden mb-6">
            <div className="flex flex-col space-y-1.5 pb-4 p-6">
              <h3 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-primary-600" />
                <span>Dagelijkse Uren Overzicht</span>
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {Array.from(new Set(hoursEntries.map(entry => entry.date.toISOString().split('T')[0])))
                  .sort()
                  .reverse()
                  .slice(0, 7)
                  .map(date => {
                    const dayEntries = getHoursForDate(date);
                    const totalHours = dayEntries.reduce((sum, entry) => sum + entry.hours, 0);
                    return (
                      <div key={date} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
      <div>
                          <div className="font-medium text-slate-900">
                            {new Date(date).toLocaleDateString('nl-NL', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </div>
                          <div className="text-xs text-slate-500">
                            {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900">
                            {formatHours(totalHours)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatCurrency(totalHours * (profiles.find(p => dayEntries[0]?.profileId === p.id)?.hourlyRate || 0))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* Middle Section - People & Hours */}
        <div className="bg-white rounded-2xl shadow-medium border border-slate-200/50 overflow-hidden">
          <div className="flex flex-col space-y-1.5 pb-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center space-x-2">
                <Users className="h-5 w-5 text-primary-600" />
                <span>Personen & Uren</span>
              </h3>
              <div className="flex items-center space-x-3">
                <button
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-success-600 text-white shadow-soft hover:bg-success-700 hover:shadow-medium focus:ring-success-500 active:scale-95"
                  onClick={handleAddHours}
                  disabled={profiles.length === 0}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Uren Toevoegen
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary-600 text-white shadow-soft hover:bg-primary-700 hover:shadow-medium focus:ring-primary-500 active:scale-95"
                  onClick={handleAddProfile}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Profiel Toevoegen
                </button>
              </div>
            </div>
          </div>
          <div className="p-6">
            {calculations.length === 0 ? (
              <div className="text-center py-12">
                <Calculator className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">Geen profielen gevonden</h3>
                <p className="text-sm text-slate-500 mb-6">Voeg profielen toe om te beginnen met het berekenen van uren en betalingen.</p>
                <button
                  className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-base font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary-600 text-white shadow-soft hover:bg-primary-700 hover:shadow-medium focus:ring-primary-500 active:scale-95"
                  onClick={handleAddProfile}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Eerste Profiel Toevoegen
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Calculation Explanation */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="font-medium text-blue-900 mb-2">📊 Hoe worden de berekeningen gemaakt?</h4>
                  <div className="text-sm text-blue-800 space-y-1">
                    <div><strong>Bruto = Uren × Uurtarief</strong> (bijv. 2 uur × €10,00 = €20,00)</div>
                    <div><strong>Netto = Bruto - Aftrekkingen</strong> (bijv. €20,00 - €2,00 = €18,00)</div>
                    <div className="text-xs text-blue-600 mt-2">
                      💡 Tip: Voeg uren toe met de groene "Uren Toevoegen" knop om positieve bedragen te zien
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Naam</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Uren</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Tarief</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Bruto</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Aftrek</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Netto</th>
                      <th className="text-center py-3 px-4 font-semibold text-slate-700">Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculations.map((calc) => {
                      const profile = profiles.find(p => p.id === calc.profileId);
                      const hourlyRate = profile?.hourlyRate || 0;
                      const hasHours = calc.totalHours > 0;
                      
                      return (
                        <tr key={calc.profileId} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-medium text-slate-900">{calc.profileName}</div>
                            {!hasHours && (
                              <div className="text-xs text-slate-500 mt-1">
                                Geen uren ingevoerd
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="text-mono">
                              {formatHours(calc.totalHours)}
                            </div>
                            {hasHours && (
                              <div className="text-xs text-slate-500 mt-1">
                                {calc.totalHours} × {formatCurrency(hourlyRate)}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right text-mono">
                            {formatCurrency(hourlyRate)}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="text-mono font-medium">
                              {formatCurrency(calc.grossAmount)}
                            </div>
                            {hasHours && (
                              <div className="text-xs text-slate-500 mt-1">
                                = {calc.totalHours} × {formatCurrency(hourlyRate)}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="text-mono text-danger-600">
                              -{formatCurrency(calc.totalDeductions)}
                            </div>
                            {calc.totalDeductions > 0 && (
                              <div className="text-xs text-slate-500 mt-1">
                                Aftrekkingen
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className={`text-mono font-semibold ${
                              calc.netAmount >= 0 ? 'text-success-600' : 'text-danger-600'
                            }`}>
                              {formatCurrency(calc.netAmount)}
                            </div>
                            {hasHours && (
                              <div className="text-xs text-slate-500 mt-1">
                                = {formatCurrency(calc.grossAmount)} - {formatCurrency(calc.totalDeductions)}
      </div>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                className="p-1 text-slate-400 hover:text-primary-600 transition-colors"
                                onClick={() => handleEditProfile(profiles.find(p => p.id === calc.profileId)!)}
                                title="Profiel bewerken"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                className="p-1 text-slate-400 hover:text-danger-600 transition-colors"
                                onClick={() => handleDeleteProfile(calc.profileId)}
                                title="Profiel verwijderen"
                              >
                                <Trash2 className="h-4 w-4" />
        </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Profile Management Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-large">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
                    {editingProfile ? 'Profiel Bewerken' : 'Nieuw Profiel'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {editingProfile ? 'Bewerk de profielgegevens' : 'Voeg een nieuw profiel toe'}
        </p>
      </div>
                <button
                  className="ml-4 -mr-2 inline-flex items-center justify-center rounded-xl px-2 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500"
                  onClick={() => setIsProfileModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Naam *
                      </label>
                      <input
                        type="text"
                        className="block w-full rounded-xl border-0 bg-white px-4 py-3 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                        placeholder="Voer naam in"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Uurtarief (€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="block w-full rounded-xl border-0 bg-white px-4 py-3 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                        placeholder="0.00"
                        value={profileForm.hourlyRate || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setProfileForm({ 
                            ...profileForm, 
                            hourlyRate: value === '' ? 0 : parseFloat(value) || 0 
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* Deduction Type */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Aftrektype
                    </label>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="deductionType"
                          value="Uurloon"
                          checked={profileForm.deductionType === 'Uurloon'}
                          onChange={(e) => setProfileForm({ ...profileForm, deductionType: e.target.value as 'Uurloon' | 'Marge' })}
                          className="mr-2"
                        />
                        Uurloon
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="deductionType"
                          value="Marge"
                          checked={profileForm.deductionType === 'Marge'}
                          onChange={(e) => setProfileForm({ ...profileForm, deductionType: e.target.value as 'Uurloon' | 'Marge' })}
                          className="mr-2"
                        />
                        Marge
                      </label>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-sm font-medium text-slate-700">
                        Aftrekkingen
                      </label>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary-600 text-white shadow-soft hover:bg-primary-700 hover:shadow-medium focus:ring-primary-500 active:scale-95"
                        onClick={addDeduction}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Toevoegen
                      </button>
                    </div>
                    
                    {profileForm.deductions.map((deduction, index) => (
                      <div key={index} className="flex items-center space-x-3 mb-3 p-3 bg-slate-50 rounded-xl">
                        <input
                          type="text"
                          placeholder="Naam aftrekking"
                          className="flex-1 rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                          value={deduction.name}
                          onChange={(e) => updateDeduction(index, 'name', e.target.value)}
                        />
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Bedrag"
                          className="w-24 rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                          value={deduction.amount || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            updateDeduction(index, 'amount', value === '' ? 0 : parseFloat(value) || 0);
                          }}
                        />
                        <select
                          className="rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                          value={deduction.type}
                          onChange={(e) => updateDeduction(index, 'type', e.target.value)}
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">€</option>
                        </select>
                        <button
                          type="button"
                          className="p-2 text-slate-400 hover:text-danger-600 transition-colors"
                          onClick={() => removeDeduction(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-200">
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500"
                      onClick={() => setIsProfileModalOpen(false)}
                    >
                      Annuleren
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary-600 text-white shadow-soft hover:bg-primary-700 hover:shadow-medium focus:ring-primary-500 active:scale-95"
                      onClick={handleSaveProfile}
                    >
                      {editingProfile ? 'Bijwerken' : 'Opslaan'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hours Input Modal */}
      {isHoursModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-large">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Uren Toevoegen</h2>
                  <p className="text-sm text-slate-500 mt-1">Voeg uren toe voor een specifieke datum</p>
                </div>
                <button
                  className="ml-4 -mr-2 inline-flex items-center justify-center rounded-xl px-2 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500"
                  onClick={() => setIsHoursModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {/* Date Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Datum *
                    </label>
                    <input
                      type="date"
                      className="block w-full rounded-xl border-0 bg-white px-4 py-3 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>

                  {/* Profile Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Profiel *
                    </label>
                    <select
                      className="block w-full rounded-xl border-0 bg-white px-4 py-3 text-slate-900 shadow-soft ring-1 ring-slate-300 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                      value={hoursForm.profileId}
                      onChange={(e) => setHoursForm({ ...hoursForm, profileId: e.target.value })}
                    >
                      <option value="">Selecteer een profiel</option>
                      {profiles.map(profile => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name} - {formatCurrency(profile.hourlyRate)}/uur
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hours Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Aantal uren *
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      className="block w-full rounded-xl border-0 bg-white px-4 py-3 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                      placeholder="0.00"
                      value={hoursForm.hours || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setHoursForm({ 
                          ...hoursForm, 
                          hours: value === '' ? 0 : parseFloat(value) || 0 
                        });
                      }}
                    />
                    <p className="text-xs text-slate-500 mt-1">Gebruik 0.25 voor 15 minuten, 0.5 voor 30 minuten, etc.</p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Beschrijving (optioneel)
                    </label>
                    <textarea
                      className="block w-full rounded-xl border-0 bg-white px-4 py-3 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                      placeholder="Wat heb je gedaan?"
                      rows={3}
                      value={hoursForm.description}
                      onChange={(e) => setHoursForm({ ...hoursForm, description: e.target.value })}
                    />
                  </div>

                  {/* Preview */}
                  {hoursForm.profileId && hoursForm.hours > 0 && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <h4 className="font-medium text-slate-900 mb-2">Preview</h4>
                      <div className="text-sm text-slate-600">
                        <div>Profiel: {profiles.find(p => p.id === hoursForm.profileId)?.name}</div>
                        <div>Datum: {new Date(selectedDate).toLocaleDateString('nl-NL')}</div>
                        <div>Uren: {formatHours(hoursForm.hours)}</div>
                        <div className="font-semibold text-slate-900">
                          Totaal: {formatCurrency(hoursForm.hours * (profiles.find(p => p.id === hoursForm.profileId)?.hourlyRate || 0))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500"
                      onClick={() => setIsHoursModalOpen(false)}
                    >
                      Annuleren
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-success-600 text-white shadow-soft hover:bg-success-700 hover:shadow-medium focus:ring-success-500 active:scale-95"
                      onClick={handleSaveHours}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      Opslaan
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export/Import Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-large">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Export & Import</h2>
                  <p className="text-sm text-slate-500 mt-1">Exporteer rapporten of importeer data</p>
                </div>
                <button
                  className="ml-4 -mr-2 inline-flex items-center justify-center rounded-xl px-2 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500"
                  onClick={() => setIsExportModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {/* PDF Export */}
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-red-600" />
                      <div className="flex-1">
                        <h3 className="font-medium text-red-900">PDF Rapport</h3>
                        <p className="text-sm text-red-700">Exporteer een professioneel PDF rapport</p>
                      </div>
                      <button
                        className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-red-600 text-white shadow-soft hover:bg-red-700 hover:shadow-medium focus:ring-red-500 active:scale-95"
                        onClick={generatePDF}
                        disabled={calculations.length === 0}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export PDF
                      </button>
                    </div>
                  </div>

                  {/* JSON Export */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <Download className="h-8 w-8 text-blue-600" />
                      <div className="flex-1">
                        <h3 className="font-medium text-blue-900">JSON Backup</h3>
                        <p className="text-sm text-blue-700">Exporteer alle data als JSON bestand</p>
                      </div>
                      <button
                        className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-blue-600 text-white shadow-soft hover:bg-blue-700 hover:shadow-medium focus:ring-blue-500 active:scale-95"
                        onClick={exportData}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export JSON
                      </button>
                    </div>
                  </div>

                  {/* JSON Import */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <Upload className="h-8 w-8 text-green-600" />
                      <div className="flex-1">
                        <h3 className="font-medium text-green-900">JSON Import</h3>
                        <p className="text-sm text-green-700">Importeer data uit een JSON backup</p>
                      </div>
                      <label className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-green-600 text-white shadow-soft hover:bg-green-700 hover:shadow-medium focus:ring-green-500 active:scale-95 cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Import JSON
                        <input
                          type="file"
                          accept=".json"
                          onChange={importData}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-medium text-slate-900 mb-2">💡 Tips</h4>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• PDF rapporten zijn perfect voor klanten en boekhouding</li>
                      <li>• JSON backups bevatten alle data inclusief instellingen</li>
                      <li>• Import overschrijft alle huidige data</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;