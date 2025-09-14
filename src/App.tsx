import React, { useState, useEffect, useCallback } from 'react';
import { Calculator, Users, Euro, FileText, Download, Upload, Plus, Trash2, X, Clock, Calendar, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import { FaQuestionCircle } from 'react-icons/fa';

// Types
interface HourlyRate {
  id: string;
  label: string;
  rate: number;
}

interface ClientRate {
  id: string;
  label: string;
  rate: number;
  employeeRateId: string; // Links to the corresponding employee rate
}

interface ProfitDistribution {
  id: string;
  name: string;
  percentage: number;
  type: 'margin' | 'profit_share';
}

interface Profile {
  id: string;
  name: string;
  hourlyRates: HourlyRate[];
  clientRates: ClientRate[];
  profitDistributions: ProfitDistribution[];
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
  appliesTo: 'employee' | 'employer' | 'both';
}

interface HoursEntry {
  id: string;
  profileId: string;
  hourlyRateId: string;
  date: Date;
  hours: number;
  description?: string;
}

interface RevenueBreakdown {
  clientPayment: number;
  employeePayment: number;
  profitMargin: number;
  profitDistribution: Array<{
    name: string;
    amount: number;
    percentage: number;
  }>;
}

interface CalculationResult {
  profileId: string;
  profileName: string;
  totalHours: number;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  deductionBreakdown: DeductionBreakdown[];
  revenueBreakdown: RevenueBreakdown;
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
  const [showCalculationTooltip, setShowCalculationTooltip] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [hoursEntries, setHoursEntries] = useState<HoursEntry[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isHoursModalOpen, setIsHoursModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [calculations, setCalculations] = useState<CalculationResult[]>([]);
  const [appliedDeductions, setAppliedDeductions] = useState<Record<string, boolean>>({});
  const [clientPayment, setClientPayment] = useState<ClientPayment>({
    totalAmount: 0,
    totalHours: 0,
    averageRate: 0,
  });
  const [paymentDistribution, setPaymentDistribution] = useState<PaymentDistribution[]>([]);
  const [showProfilesToast, setShowProfilesToast] = useState(false);

  const generateId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    hourlyRates: [] as Omit<HourlyRate, 'id'>[],
    clientRates: [] as Omit<ClientRate, 'id'>[],
    profitDistributions: [] as Omit<ProfitDistribution, 'id'>[],
    deductionType: 'Uurloon' as 'Uurloon' | 'Marge',
    deductions: [] as Omit<Deduction, 'id'>[],
  });

  // Hours form state
  const [hoursForm, setHoursForm] = useState({
    profileId: '',
    hourlyRateId: '',
    hours: 0,
    description: '',
  });

  // Load data from localStorage on app start
  useEffect(() => {
    const savedProfiles = localStorage.getItem('urenregistratie-profiles');
    const savedHours = localStorage.getItem('urenregistratie-hours');
    const savedAppliedDeductions = localStorage.getItem('urenregistratie-applied-deductions');

    if (savedProfiles) {
      try {
        const parsedProfiles = JSON.parse(savedProfiles).map((profile: Profile & { hourlyRate?: number }) => ({
          ...profile,
          // Migrate old single hourlyRate to hourlyRates array
          hourlyRates: profile.hourlyRates || (profile.hourlyRate ? [{
            id: generateId(),
            label: 'Standard Rate',
            rate: profile.hourlyRate
          }] : []),
          // Initialize new fields if they don't exist
          clientRates: profile.clientRates || [],
          profitDistributions: profile.profitDistributions || [],
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
        const parsedHours = JSON.parse(savedHours).map((entry: HoursEntry & { hourlyRateId?: string }) => ({
          ...entry,
          date: new Date(entry.date),
        }));
        setHoursEntries(parsedHours);
      } catch (error) {
        console.error('Error loading hours:', error);
      }
    }

    if (savedAppliedDeductions) {
      try {
        setAppliedDeductions(JSON.parse(savedAppliedDeductions));
      } catch (error) {
        console.error('Error loading applied deductions:', error);
      }
    }
  }, []);

  // Save data to localStorage whenever profiles, hours or applied deductions change
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

  useEffect(() => {
    if (Object.keys(appliedDeductions).length > 0) {
      localStorage.setItem('urenregistratie-applied-deductions', JSON.stringify(appliedDeductions));
    }
  }, [appliedDeductions]);

  // Initialize applied deductions when profiles change
  useEffect(() => {
    if (profiles.length > 0) {
      const newAppliedDeductions: Record<string, boolean> = { ...appliedDeductions };

      profiles.forEach(profile => {
        profile.deductions.forEach(deduction => {
          const deductionKey = `${profile.id}-${deduction.id}`;
          if (newAppliedDeductions[deductionKey] === undefined) {
            newAppliedDeductions[deductionKey] = true; // Default to applied
          }
        });
      });

      setAppliedDeductions(newAppliedDeductions);
    }
  }, [profiles, appliedDeductions]);

  const calculateRevenueBreakdown = (profile: Profile, profileEntries: HoursEntry[], employeePayment: number): RevenueBreakdown => {
    // Calculate client payment based on client rates
    let clientPayment = 0;
    profileEntries.forEach(entry => {
      // Find the corresponding hourly rate for this entry
      const hourlyRate = profile.hourlyRates.find(rate => rate.id === entry.hourlyRateId);
      if (hourlyRate) {
        // Find client rate that corresponds to this hourly rate
        const clientRate = profile.clientRates.find(rate => {
          // For now, we'll match by index since we're using form indices
          const hourlyRateIndex = profile.hourlyRates.findIndex(hr => hr.id === hourlyRate.id);
          return rate.employeeRateId === hourlyRateIndex.toString();
        });
        
        if (clientRate) {
          clientPayment += entry.hours * clientRate.rate;
        } else {
          // If no client rate found, use employee rate * 2 as default client rate
          clientPayment += entry.hours * hourlyRate.rate * 2;
        }
      }
    });

    // If no client rates are set, use employee payment * 2 as client payment
    if (clientPayment === 0) {
      clientPayment = employeePayment * 2;
    }

    // Calculate profit margin (difference between client payment and employee payment)
    const profitMargin = clientPayment - employeePayment;

    // Calculate profit distribution
    const profitDistributions = profile.profitDistributions.map(dist => {
      let amount = 0;
      if (dist.type === 'margin') {
        // Margin is calculated as percentage of employee payment
        amount = (employeePayment * dist.percentage) / 100;
      } else if (dist.type === 'profit_share') {
        // Profit share is calculated as percentage of profit margin
        amount = (profitMargin * dist.percentage) / 100;
      }
      
      return {
        name: dist.name,
        amount,
        percentage: dist.percentage,
      };
    });

    return {
      clientPayment,
      employeePayment,
      profitMargin,
      profitDistribution: profitDistributions,
    };
  };

  const calculateTotals = useCallback(() => {
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
      
      // Calculate gross amount using the actual rates from hours entries
      let grossAmount = 0;
      const profileEntries = hoursEntries.filter(entry => entry.profileId === profile.id);
      profileEntries.forEach(entry => {
        const hourlyRate = profile.hourlyRates.find(rate => rate.id === entry.hourlyRateId);
        if (hourlyRate) {
          grossAmount += entry.hours * hourlyRate.rate;
        }
      });

      // Calculate deductions (prioritize Uurloon before Marge)
      let totalDeductions = 0;
      const deductionBreakdown = profile.deductions
        .sort((a, b) => a.priority - b.priority)
        .map(deduction => {
          const deductionKey = `${profile.id}-${deduction.id}`;
          const isApplied = appliedDeductions[deductionKey] !== false;

          const amount = isApplied
            ? (deduction.type === 'percentage'
              ? (grossAmount * deduction.amount) / 100
              : deduction.amount)
            : 0;

          totalDeductions += amount;
          return {
            deductionId: deduction.id,
            deductionName: deduction.name,
            amount,
            type: deduction.type,
          };
        });

      // Calculate revenue breakdown
      const revenueBreakdown = calculateRevenueBreakdown(profile, profileEntries, grossAmount);

      return {
        profileId: profile.id,
        profileName: profile.name,
        totalHours,
        grossAmount,
        totalDeductions,
        netAmount: grossAmount - totalDeductions,
        deductionBreakdown,
        revenueBreakdown,
      };
    });

    setCalculations(results);

    // Calculate client payment using revenue breakdown
    const totalClientPayment = results.reduce((sum, result) => sum + result.revenueBreakdown.clientPayment, 0);
    const totalHours = results.reduce((sum, result) => sum + result.totalHours, 0);
    const averageRate = totalHours > 0 ? totalClientPayment / totalHours : 0;

    setClientPayment({
      totalAmount: totalClientPayment,
      totalHours,
      averageRate,
    });

    // Calculate payment distribution
    const distribution: PaymentDistribution[] = results.map(result => ({
      profileId: result.profileId,
      profileName: result.profileName,
      amount: result.netAmount,
      percentage: totalClientPayment > 0 ? (result.netAmount / totalClientPayment) * 100 : 0,
    }));

    setPaymentDistribution(distribution);
  }, [profiles, hoursEntries, appliedDeductions]);

  // Calculate totals whenever data changes
  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  const toggleDeduction = (profileId: string, deductionId: string) => {
    const deductionKey = `${profileId}-${deductionId}`;
    setAppliedDeductions(prev => ({
      ...prev,
      [deductionKey]: !prev[deductionKey]
    }));
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

  const handleAddProfile = () => {
    setEditingProfile(null);
    setProfileForm({
      name: '',
      hourlyRates: [],
      clientRates: [],
      profitDistributions: [],
      deductionType: 'Uurloon',
      deductions: [],
    });
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = () => {
    if (!profileForm.name.trim() || profileForm.hourlyRates.length === 0) {
      alert('Vul alle verplichte velden in en voeg ten minste één uurtarief toe');
      return;
    }

    // Validate that all hourly rates have valid data
    const hasInvalidRates = profileForm.hourlyRates.some(rate => 
      !rate.label.trim() || rate.rate <= 0
    );
    if (hasInvalidRates) {
      alert('Alle uurtarieven moeten een naam en een geldig bedrag hebben');
      return;
    }

    const newProfile: Profile = {
      id: editingProfile?.id || generateId(),
      name: profileForm.name.trim(),
      hourlyRates: profileForm.hourlyRates.map((rate, index) => ({
        id: editingProfile?.hourlyRates[index]?.id || generateId(),
        ...rate,
      })),
      clientRates: profileForm.clientRates.map((rate, index) => ({
        id: editingProfile?.clientRates[index]?.id || generateId(),
        ...rate,
      })),
      profitDistributions: profileForm.profitDistributions.map((dist, index) => ({
        id: editingProfile?.profitDistributions[index]?.id || generateId(),
        ...dist,
      })),
      deductionType: profileForm.deductionType,
      deductions: profileForm.deductions.map((d, index) => ({
        id: editingProfile?.deductions[index]?.id || generateId(),
        ...d,
        priority: index,
        appliesTo: d.appliesTo || 'employee', // Default to employee
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
  // const handleEditProfile = (profile: Profile) => {
  //   setEditingProfile(profile);
  //   setProfileForm({
  //     name: profile.name,
  //     hourlyRate: profile.hourlyRate,
  //     deductionType: profile.deductionType,
  //     deductions: profile.deductions.map(d => ({
  //       name: d.name,
  //       amount: d.amount,
  //       type: d.type,
  //       priority: d.priority,
  //       appliesTo: d.appliesTo,
  //     })),
  //   });
  //   setIsProfileModalOpen(true);
  // };

  // Add this delete function
  const handleDeleteProfile = (profile: Profile) => {
    setProfileToDelete(profile);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteProfile = () => {
    if (!profileToDelete) return;

    // Remove the profile
    const newProfiles = profiles.filter(p => p.id !== profileToDelete.id);
    setProfiles(newProfiles);

    // Remove related hours entries
    const newHoursEntries = hoursEntries.filter(h => h.profileId !== profileToDelete.id);
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

    // Close the modal and reset state
    setIsDeleteModalOpen(false);
    setProfileToDelete(null);
  };

  const addHourlyRate = () => {
    setProfileForm({
      ...profileForm,
      hourlyRates: [
        ...profileForm.hourlyRates,
        {
          label: '',
          rate: 0,
        },
      ],
    });
  };

  const removeHourlyRate = (index: number) => {
    setProfileForm({
      ...profileForm,
      hourlyRates: profileForm.hourlyRates.filter((_, i) => i !== index),
    });
  };

  const updateHourlyRate = (index: number, field: string, value: string | number) => {
    const newRates = [...profileForm.hourlyRates];
    newRates[index] = { ...newRates[index], [field]: value };
    setProfileForm({ ...profileForm, hourlyRates: newRates });
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
          appliesTo: 'employee',
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

  const updateDeduction = (index: number, field: string, value: string | number) => {
    const newDeductions = [...profileForm.deductions];
    newDeductions[index] = { ...newDeductions[index], [field]: value };
    setProfileForm({ ...profileForm, deductions: newDeductions });
  };

  // Client rates management functions
  const addClientRate = () => {
    setProfileForm({
      ...profileForm,
      clientRates: [
        ...profileForm.clientRates,
        {
          label: '',
          rate: 0,
          employeeRateId: '',
        },
      ],
    });
  };

  const removeClientRate = (index: number) => {
    setProfileForm({
      ...profileForm,
      clientRates: profileForm.clientRates.filter((_, i) => i !== index),
    });
  };

  const updateClientRate = (index: number, field: string, value: string | number) => {
    const newRates = [...profileForm.clientRates];
    newRates[index] = { ...newRates[index], [field]: value };
    setProfileForm({ ...profileForm, clientRates: newRates });
  };

  // Profit distribution management functions
  const addProfitDistribution = () => {
    setProfileForm({
      ...profileForm,
      profitDistributions: [
        ...profileForm.profitDistributions,
        {
          name: '',
          percentage: 0,
          type: 'profit_share',
        },
      ],
    });
  };

  const removeProfitDistribution = (index: number) => {
    setProfileForm({
      ...profileForm,
      profitDistributions: profileForm.profitDistributions.filter((_, i) => i !== index),
    });
  };

  const updateProfitDistribution = (index: number, field: string, value: string | number) => {
    const newDistributions = [...profileForm.profitDistributions];
    newDistributions[index] = { ...newDistributions[index], [field]: value };
    setProfileForm({ ...profileForm, profitDistributions: newDistributions });
  };

  // Hours management functions
  const handleAddHours = () => {
    if (profiles.length === 0) {
      alert('Voeg eerst een profiel toe');
      return;
    }
    const firstProfile = profiles[0];
    setHoursForm({
      profileId: firstProfile.id,
      hourlyRateId: firstProfile.hourlyRates.length > 0 ? firstProfile.hourlyRates[0].id : '',
      hours: 0,
      description: '',
    });
    setIsHoursModalOpen(true);
  };

  const handleSaveHours = () => {
    if (!hoursForm.profileId || !hoursForm.hourlyRateId || hoursForm.hours <= 0) {
      alert('Selecteer een profiel, uurtarief en voer geldige uren in');
      return;
    }

    const newHoursEntry: HoursEntry = {
      id: generateId(),
      profileId: hoursForm.profileId,
      hourlyRateId: hoursForm.hourlyRateId,
      date: new Date(selectedDate),
      hours: hoursForm.hours,
      description: hoursForm.description.trim() || undefined,
    };

    setHoursEntries([...hoursEntries, newHoursEntry]);
    setIsHoursModalOpen(false);
    setHoursForm({
      profileId: '',
      hourlyRateId: '',
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
        const profile = profiles.find(p => p.id === calc.profileId);
        const profileEntries = hoursEntries.filter(entry => entry.profileId === calc.profileId);
        let totalEarnings = 0;
        let totalHours = 0;
        profileEntries.forEach(entry => {
          const hourlyRate = profile?.hourlyRates.find(rate => rate.id === entry.hourlyRateId);
          if (hourlyRate) {
            totalEarnings += entry.hours * hourlyRate.rate;
            totalHours += entry.hours;
          }
        });
        const averageRate = totalHours > 0 ? totalEarnings / totalHours : 0;

        const rowData = [
          calc.profileName,
          formatHours(calc.totalHours),
          formatCurrency(averageRate),
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
          const importedProfiles = data.profiles.map((profile: Profile & { hourlyRate?: number }) => ({
            ...profile,
            createdAt: new Date(profile.createdAt),
            updatedAt: new Date(profile.updatedAt),
          }));
          setProfiles(importedProfiles);
        }

        if (data.hoursEntries) {
          const importedHours = data.hoursEntries.map((entry: HoursEntry & { hourlyRateId?: string }) => ({
            ...entry,
            date: new Date(entry.date),
          }));
          setHoursEntries(importedHours);
        }

        alert('Data succesvol geïmporteerd!');
      } catch {
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
                onClick={() => {
                  if (profiles.length === 0) {
                    handleAddProfile();
                  } else {
                    setShowProfilesToast(!showProfilesToast);
                  }
                }}
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
                            {formatCurrency(totalHours * clientPayment.averageRate)}
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
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center space-x-2">
                  <Users className="h-5 w-5 text-primary-600" />
                  <span className="cursor-help border-b border-dashed border-slate-300 text-green-500">
                    Personen & Uren
                  </span>
                  <FaQuestionCircle className='text-xl mr-1 text-blue-500'
                    onMouseEnter={() => setShowCalculationTooltip(true)}
                    onMouseLeave={() => setShowCalculationTooltip(false)} />
                </h3>
              </div>

              <div className="flex items-center space-x-3">
                {/* Empty space for alignment */}
              </div>
            </div>
          </div>

          {/* Tooltip that appears above the table with smooth transition */}
          <div className={`overflow-hidden transition-all duration-1000 ease-in-out ${showCalculationTooltip ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
            {showCalculationTooltip && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl m-4 p-4">
                <h4 className="font-medium text-blue-900 mb-2">📊 Hoe worden de berekeningen gemaakt?</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <div><strong>Bruto = Uren × Uurtarief</strong> (bijv. 2 uur × €10,00 = €20,00)</div>
                  <div><strong>Netto = Bruto - Aftrekkingen</strong> (bijv. €20,00 - €2,00 = €18,00)</div>
                  <div className="text-xs text-blue-600 mt-2">
                    💡 Tip: Voeg uren toe met de groene "Uren Toevoegen" knop om positieve bedragen te zien
                  </div>
                </div>
              </div>
            )}
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
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-soft">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 backdrop-blur-sm">
                      <th className="text-left py-4 px-6 font-semibold text-slate-700 border-b border-slate-200 border-r">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-2 text-primary-600" />
                          Naam
                        </div>
                      </th>
                      <th className="text-right py-4 px-6 font-semibold text-slate-700 border-b border-slate-200 border-r ">
                        <div className="flex items-center justify-end">
                          <Clock className="h-4 w-4 mr-2 text-blue-600" />
                          Uren
                        </div>
                      </th>
                      <th className="text-right py-4 px-6 font-semibold text-slate-700 border-b border-slate-200 border-r ">
                        <div className="flex items-center justify-end">
                          <Euro className="h-4 w-4 mr-2 text-green-600" />
                          Gemiddeld Tarief
                        </div>
                      </th>
                      <th className="text-right py-4 px-6 font-semibold text-slate-700 border-b border-slate-200 border-r ">
                        <div className="flex items-center justify-end">
                          <FileText className="h-4 w-4 mr-2 text-blue-600" />
                          Bruto
                        </div>
                      </th>
                      <th className="text-right py-4 px-6 font-semibold text-slate-700 border-b border-slate-200 border-r ">
                        <div className="flex items-center justify-end">
                          <Trash2 className="h-4 w-4 mr-2 text-red-600" />
                          Aftrek
                        </div>
                      </th>
                      <th className="text-right py-4 px-6 font-semibold text-slate-700 border-b border-slate-200 border-r ">
                        <div className="flex items-center justify-end">
                          <Calculator className="h-4 w-4 mr-2 text-green-600" />
                          Netto
                        </div>
                      </th>
                      <th className="text-center py-4 px-6 font-semibold text-slate-700 border-b border-slate-200">
                        <div className="flex items-center justify-center">
                          <Trash2 className="h-4 w-4 mr-2 text-orange-600" />
                          Aftrekkingen
                        </div>
                      </th>
                      <th className="text-center py-4 px-6 font-semibold text-slate-700 border-b border-slate-200">
                        <div className="flex items-center justify-center">
                          <Calculator className="h-4 w-4 mr-2 text-purple-600" />
                          Winstverdeling
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculations.map((calc, index) => {
                      const profile = profiles.find(p => p.id === calc.profileId);
                      const hasHours = calc.totalHours > 0;
                      
                      // Calculate average hourly rate for this profile
                      const profileEntries = hoursEntries.filter(entry => entry.profileId === calc.profileId);
                      let totalEarnings = 0;
                      let totalHours = 0;
                      profileEntries.forEach(entry => {
                        const hourlyRate = profile?.hourlyRates.find(rate => rate.id === entry.hourlyRateId);
                        if (hourlyRate) {
                          totalEarnings += entry.hours * hourlyRate.rate;
                          totalHours += entry.hours;
                        }
                      });
                      const averageRate = totalHours > 0 ? totalEarnings / totalHours : 0;

                      return (
                        <tr
                          key={calc.profileId}
                          className={`transition-all duration-300 hover:bg-blue-50/50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                        >
                          <td className="py-4 px-6 border-b border-slate-200 border-r ">
                            <div className="font-medium text-slate-900 flex items-center">
                              <div className="w-3 h-3 bg-primary-500 rounded-full mr-3"></div>
                              {calc.profileName}
                            </div>
                            {!hasHours && (
                              <div className="text-xs text-slate-500 mt-1 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                Geen uren ingevoerd
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right border-b border-slate-200 border-r ">
                            <div className="text-mono font-semibold text-blue-700">
                              {formatHours(calc.totalHours)}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right border-b border-slate-200 border-r ">
                            <div className="text-mono font-medium text-green-700">
                              {formatCurrency(averageRate)}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right border-b border-slate-200 border-r ">
                            <div className="text-mono font-bold text-blue-800">
                              {formatCurrency(calc.grossAmount)}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right border-b border-slate-200 border-r ">
                            <div className="text-mono font-semibold text-red-600">
                              -{formatCurrency(calc.totalDeductions)}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right border-b border-slate-200 border-r ">
                            <div className={`text-mono font-bold text-lg ${calc.netAmount >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {formatCurrency(calc.netAmount)}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center border-b border-slate-200">
                            <div className="space-y-2">
                              {profile?.deductions.map(deduction => {
                                const deductionKey = `${profile.id}-${deduction.id}`;
                                const isApplied = appliedDeductions[deductionKey] !== false;

                                return (
                                  <div key={deduction.id} className="flex items-center justify-center space-x-2">
                                    <span className="text-xs text-slate-600 truncate max-w-20">
                                      {deduction.name}
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isApplied}
                                        onChange={() => toggleDeduction(profile.id, deduction.id)}
                                        className="sr-only peer"
                                      />
                                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary-600"></div>
                                    </label>
                                  </div>
                                );
                              })}
                              {profile?.deductions.length === 0 && (
                                <div className="text-xs text-slate-400">
                                  Geen aftrekkingen
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center border-b border-slate-200">
                            <div className="space-y-2">
                              {/* Client Payment */}
                              <div className="text-xs">
                                <div className="text-blue-600 font-medium">
                                  Klant: {formatCurrency(calc.revenueBreakdown.clientPayment)}
                                </div>
                                <div className="text-slate-500">
                                  Werknemer: {formatCurrency(calc.revenueBreakdown.employeePayment)}
                                </div>
                                <div className="text-green-600 font-medium">
                                  Winst: {formatCurrency(calc.revenueBreakdown.profitMargin)}
                                </div>
                              </div>
                              
                              {/* Profit Distribution */}
                              {calc.revenueBreakdown.profitDistribution.map((dist, idx) => (
                                <div key={idx} className="text-xs text-purple-600">
                                  {dist.name}: {formatCurrency(dist.amount)}
                                </div>
                              ))}
                              
                              {calc.revenueBreakdown.profitDistribution.length === 0 && (
                                <div className="text-xs text-slate-400">
                                  Geen winstverdeling
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Profiles Selection Toast/Sidebar */}
        {showProfilesToast && (
          <div className="fixed right-4 top-[139px] z-50 bg-white rounded-xl shadow-large border border-slate-200 w-80 max-h-96 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Selecteer Profiel</h3>
                <button
                  onClick={() => setShowProfilesToast(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="p-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer transition-colors group relative"
                  onClick={() => {
                    setEditingProfile(profile);
                    setProfileForm({
                      name: profile.name,
                      hourlyRates: profile.hourlyRates.map(rate => ({
                        label: rate.label,
                        rate: rate.rate,
                      })),
                      clientRates: profile.clientRates.map(rate => ({
                        label: rate.label,
                        rate: rate.rate,
                        employeeRateId: rate.employeeRateId,
                      })),
                      profitDistributions: profile.profitDistributions.map(dist => ({
                        name: dist.name,
                        percentage: dist.percentage,
                        type: dist.type,
                      })),
                      deductionType: profile.deductionType,
                      deductions: profile.deductions.map(d => ({
                        name: d.name,
                        amount: d.amount,
                        type: d.type,
                        priority: d.priority,
                        appliesTo: d.appliesTo,
                      })),
                    });
                    setShowProfilesToast(false);
                    setIsProfileModalOpen(true);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                      
                      <span className="font-medium text-slate-900">{profile.name}</span>
                    </div>
                    <div className="text-sm text-slate-500">
                      {profile.hourlyRates.length} tarief{profile.hourlyRates.length !== 1 ? 'en' : ''}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {profile.deductions.length} aftrekking{profile.deductions.length !== 1 ? 'en' : ''}
                  </div>

                  {/* Delete button - only visible on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProfile(profile);
                    }}
                    className="absolute top-11   right-2 p-1 text-slate-400 hover:text-danger-600 transition-colors opacity-100"
                    title="Profiel verwijderen"
                  >
                    <Trash2 className="h-5 w-8" />
                  </button>
                </div>
              ))}

              {/* Add New Profile Button */}
              <div
                className="p-4 border-t border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => {
                  setShowProfilesToast(false);
                  handleAddProfile();
                }}
              >
                <div className="flex items-center space-x-2 text-primary-600">
                  <Plus className="h-4 w-4" />
                  <span className="font-medium">Nieuw profiel toevoegen</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && profileToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-large">
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-danger-100 rounded-xl">
                    <AlertCircle className="h-6 w-6 text-danger-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Profiel Verwijderen</h2>
                    <p className="text-sm text-slate-500 mt-1">Weet u zeker dat u dit profiel wilt verwijderen?</p>
                  </div>
                </div>
                <button
                  className="ml-4 -mr-2 inline-flex items-center justify-center rounded-xl px-2 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500"
                  onClick={() => setIsDeleteModalOpen(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <h3 className="font-medium text-slate-900">{profileToDelete.name}</h3>
                    <div className="text-sm text-slate-500 mt-1">
                      {profileToDelete.hourlyRates.length} tarief{profileToDelete.hourlyRates.length !== 1 ? 'en' : ''} • {profileToDelete.deductions.length} aftrekkingen
                    </div>
                    <div className="text-xs text-slate-400 mt-2">
                      Aangemaakt: {new Date(profileToDelete.createdAt).toLocaleDateString('nl-NL')}
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-amber-900">Let op!</h4>
                        <p className="text-sm text-amber-700 mt-1">
                          Alle uren die aan dit profiel zijn gekoppeld, worden ook verwijderd. Deze actie kan niet ongedaan worden gemaakt.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-500"
                      onClick={() => setIsDeleteModalOpen(false)}
                    >
                      Annuleren
                    </button>
                    <button
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-danger-600 text-white shadow-soft hover:bg-danger-700 hover:shadow-medium focus:ring-danger-500 active:scale-95"
                      onClick={confirmDeleteProfile}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Verwijderen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <div className="flex flex-col gap-4">
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
                      <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-slate-700">
                          Uurtarieven *
                        </label>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary-600 text-white shadow-soft hover:bg-primary-700 hover:shadow-medium focus:ring-primary-500 active:scale-95"
                          onClick={addHourlyRate}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Tarief Toevoegen
                        </button>
                      </div>

                      {profileForm.hourlyRates.map((rate, index) => (
                        <div key={index} className="flex items-center space-x-3 mb-3 p-3 bg-slate-50 rounded-xl">
                          <input
                            type="text"
                            placeholder="Naam tarief (bijv. Standaard, Overtime)"
                            className="flex-1 rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                            value={rate.label}
                            onChange={(e) => updateHourlyRate(index, 'label', e.target.value)}
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="€0.00"
                            className="w-24 rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                            value={rate.rate || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateHourlyRate(index, 'rate', value === '' ? 0 : parseFloat(value) || 0);
                            }}
                          />
                          <button
                            type="button"
                            className="p-2 text-slate-400 hover:text-danger-600 transition-colors"
                            onClick={() => removeHourlyRate(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {profileForm.hourlyRates.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                          <Euro className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                          <p className="text-sm">Voeg uurtarieven toe om te beginnen</p>
                        </div>
                      )}
                    </div>

                    {/* Client Rates Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-slate-700">
                          Klant Tarieven (Wat je aan klant vraagt)
                        </label>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-blue-600 text-white shadow-soft hover:bg-blue-700 hover:shadow-medium focus:ring-blue-500 active:scale-95"
                          onClick={addClientRate}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Klant Tarief Toevoegen
                        </button>
                      </div>

                      {profileForm.clientRates.map((rate, index) => (
                        <div key={index} className="flex items-center space-x-3 mb-3 p-3 bg-blue-50 rounded-xl">
                          <input
                            type="text"
                            placeholder="Naam klant tarief"
                            className="flex-1 rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 transition-all duration-200"
                            value={rate.label}
                            onChange={(e) => updateClientRate(index, 'label', e.target.value)}
                          />
                          <select
                            className="rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 transition-all duration-200"
                            value={rate.employeeRateId}
                            onChange={(e) => updateClientRate(index, 'employeeRateId', e.target.value)}
                          >
                            <option value="">Selecteer werknemer tarief</option>
                            {profileForm.hourlyRates.map((empRate, empIndex) => (
                              <option key={empIndex} value={empIndex}>
                                {empRate.label} - {formatCurrency(empRate.rate)}/uur
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="€0.00"
                            className="w-24 rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 transition-all duration-200"
                            value={rate.rate || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateClientRate(index, 'rate', value === '' ? 0 : parseFloat(value) || 0);
                            }}
                          />
                          <button
                            type="button"
                            className="p-2 text-slate-400 hover:text-danger-600 transition-colors"
                            onClick={() => removeClientRate(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}

                      {profileForm.clientRates.length === 0 && (
                        <div className="text-center py-6 text-slate-500">
                          <Euro className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm">Voeg klant tarieven toe om winstmarge te berekenen</p>
                        </div>
                      )}
                    </div>

                    {/* Profit Distribution Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-slate-700">
                          Winstverdeling
                        </label>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-green-600 text-white shadow-soft hover:bg-green-700 hover:shadow-medium focus:ring-green-500 active:scale-95"
                          onClick={addProfitDistribution}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Winstverdeling Toevoegen
                        </button>
                      </div>

                      {profileForm.profitDistributions.map((dist, index) => (
                        <div key={index} className="flex flex-col space-y-3 mb-4 p-3 bg-green-50 rounded-xl">
                          <div className="flex items-center space-x-3">
                            <input
                              type="text"
                              placeholder="Naam (bijv. Dylan, Mijn Marge)"
                              className="flex-1 rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:ring-offset-0 transition-all duration-200"
                              value={dist.name}
                              onChange={(e) => updateProfitDistribution(index, 'name', e.target.value)}
                            />
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              placeholder="Percentage"
                              className="w-24 rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-green-500 focus:ring-offset-0 transition-all duration-200"
                              value={dist.percentage || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                updateProfitDistribution(index, 'percentage', value === '' ? 0 : parseFloat(value) || 0);
                              }}
                            />
                            <select
                              className="rounded-xl border-0 bg-white px-3 py-2 text-slate-900 shadow-soft ring-1 ring-slate-300 focus:ring-2 focus:ring-green-500 focus:ring-offset-0 transition-all duration-200"
                              value={dist.type}
                              onChange={(e) => updateProfitDistribution(index, 'type', e.target.value)}
                            >
                              <option value="margin">Van werknemer betaling</option>
                              <option value="profit_share">Van winstmarge</option>
                            </select>
                            <button
                              type="button"
                              className="p-2 text-slate-400 hover:text-danger-600 transition-colors"
                              onClick={() => removeProfitDistribution(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="text-xs text-slate-600 pl-2">
                            {dist.type === 'margin' 
                              ? `Krijgt ${dist.percentage}% van wat de werknemer verdient`
                              : `Krijgt ${dist.percentage}% van de winstmarge (klant betaling - werknemer betaling)`
                            }
                          </div>
                        </div>
                      ))}

                      {profileForm.profitDistributions.length === 0 && (
                        <div className="text-center py-6 text-slate-500">
                          <Calculator className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                          <p className="text-sm">Voeg winstverdeling toe om automatisch te berekenen</p>
                        </div>
                      )}
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
                      <div key={index} className="flex flex-col space-y-3 mb-4 p-3 bg-slate-50 rounded-xl">
                        <div className="flex items-center space-x-3">
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

                        {/* Who does this deduction apply to? */}
                        <div className="space-y-3 pl-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-slate-700">Van toepassing op:</span>
                            <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                              Wie betaalt deze aftrekking?
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                              <input
                                type="radio"
                                name={`deduction-applies-to-${index}`}
                                value="employee"
                                checked={deduction.appliesTo === 'employee'}
                                onChange={(e) => updateDeduction(index, 'appliesTo', e.target.value as 'employee' | 'employer' | 'both')}
                                className="mr-2"
                              />
                              <div>
                                <div className="text-sm font-medium text-slate-700">Werknemer</div>
                                <div className="text-xs text-slate-500">Aftrekking gaat van werknemer loon</div>
                              </div>
                            </label>
                            <label className="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                              <input
                                type="radio"
                                name={`deduction-applies-to-${index}`}
                                value="employer"
                                checked={deduction.appliesTo === 'employer'}
                                onChange={(e) => updateDeduction(index, 'appliesTo', e.target.value as 'employee' | 'employer' | 'both')}
                                className="mr-2"
                              />
                              <div>
                                <div className="text-sm font-medium text-slate-700">Werkgever</div>
                                <div className="text-xs text-slate-500">Aftrekking gaat van werkgever kosten</div>
                              </div>
                            </label>
                            <label className="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                              <input
                                type="radio"
                                name={`deduction-applies-to-${index}`}
                                value="both"
                                checked={deduction.appliesTo === 'both'}
                                onChange={(e) => updateDeduction(index, 'appliesTo', e.target.value as 'employee' | 'employer' | 'both')}
                                className="mr-2"
                              />
                              <div>
                                <div className="text-sm font-medium text-slate-700">Beide</div>
                                <div className="text-xs text-slate-500">Aftrekking wordt gedeeld</div>
                              </div>
                            </label>
                          </div>
                          <div className="text-xs text-slate-500 bg-blue-50 p-2 rounded">
                            💡 <strong>Voorbeeld:</strong> Sociale premies (werknemer), werkgeversverzekering (werkgever), of pensioenpremie (beide)
                          </div>
                        </div>
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
                      onChange={(e) => {
                        const selectedProfile = profiles.find(p => p.id === e.target.value);
                        setHoursForm({ 
                          ...hoursForm, 
                          profileId: e.target.value,
                          hourlyRateId: selectedProfile?.hourlyRates && selectedProfile.hourlyRates.length > 0 ? selectedProfile.hourlyRates[0].id : ''
                        });
                      }}
                    >
                      <option value="">Selecteer een profiel</option>
                      {profiles.map(profile => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name} ({profile.hourlyRates.length} tarief{profile.hourlyRates.length !== 1 ? 'en' : ''})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hourly Rate Selection */}
                  {hoursForm.profileId && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Uurtarief *
                      </label>
                      <select
                        className="block w-full rounded-xl border-0 bg-white px-4 py-3 text-slate-900 shadow-soft ring-1 ring-slate-300 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 transition-all duration-200"
                        value={hoursForm.hourlyRateId}
                        onChange={(e) => setHoursForm({ ...hoursForm, hourlyRateId: e.target.value })}
                      >
                        <option value="">Selecteer een uurtarief</option>
                        {profiles.find(p => p.id === hoursForm.profileId)?.hourlyRates.map(rate => (
                          <option key={rate.id} value={rate.id}>
                            {rate.label} - {formatCurrency(rate.rate)}/uur
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

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
                  {hoursForm.profileId && hoursForm.hourlyRateId && hoursForm.hours > 0 && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <h4 className="font-medium text-slate-900 mb-2">Preview</h4>
                      <div className="text-sm text-slate-600">
                        <div>Profiel: {profiles.find(p => p.id === hoursForm.profileId)?.name}</div>
                        <div>Tarief: {profiles.find(p => p.id === hoursForm.profileId)?.hourlyRates.find(r => r.id === hoursForm.hourlyRateId)?.label}</div>
                        <div>Datum: {new Date(selectedDate).toLocaleDateString('nl-NL')}</div>
                        <div>Uren: {formatHours(hoursForm.hours)}</div>
                        <div className="font-semibold text-slate-900">
                          Totaal: {formatCurrency(hoursForm.hours * (profiles.find(p => p.id === hoursForm.profileId)?.hourlyRates.find(r => r.id === hoursForm.hourlyRateId)?.rate || 0))}
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
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-large animate-fadeIn">
              {/* Header */}
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

              {/* Body */}
              <div className="p-6">
                <div className="space-y-4">
                  {/* PDF Export */}
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-red-600 animate-pulse" />
                      <div className="flex-1">
                        <h3 className="font-medium text-red-900">PDF Rapport</h3>
                        <p className="text-sm text-red-700">
                          Exporteer een professioneel PDF rapport met overzichtelijke tabellen
                        </p>
                        <p className="text-xs text-red-500 italic mt-1">
                          📄 Inclusief samenvatting & profielen
                        </p>
                      </div>
                      <button
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none shadow-soft active:scale-95
                    ${calculations.length === 0
                            ? "bg-red-200 text-red-500 cursor-not-allowed"
                            : "bg-red-600 text-white hover:bg-red-700 hover:shadow-medium focus:ring-red-500 animate-bounceOnce"
                          }`}
                        onClick={generatePDF}
                        disabled={calculations.length === 0}
                        title={calculations.length === 0 ? "Voeg profielen toe om PDF te exporteren" : "Download PDF"}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Export PDF
                      </button>
                    </div>
                  </div>

                  {/* JSON Export */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
                    <div className="flex items-center space-x-3">
                      <Download className="h-8 w-8 text-blue-600" />
                      <div className="flex-1">
                        <h3 className="font-medium text-blue-900">JSON Backup</h3>
                        <p className="text-sm text-blue-700">Exporteer alle data als JSON bestand</p>
                      </div>
                      <button
                        className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-blue-600 text-white shadow-soft hover:bg-blue-700 hover:shadow-medium focus:ring-blue-500 active:scale-95"
                        onClick={exportData}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export JSON
                      </button>
                    </div>
                  </div>

                  {/* JSON Import */}
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl transition-all duration-300 hover:shadow-md hover:scale-[1.01]">
                    <div className="flex items-center space-x-3">
                      <Upload className="h-8 w-8 text-green-600" />
                      <div className="flex-1">
                        <h3 className="font-medium text-green-900">JSON Import</h3>
                        <p className="text-sm text-green-700">Importeer data uit een JSON backup</p>
                      </div>
                      <label className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 bg-green-600 text-white shadow-soft hover:bg-green-700 hover:shadow-medium focus:ring-green-500 active:scale-95 cursor-pointer">
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