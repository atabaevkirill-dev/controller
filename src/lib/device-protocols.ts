// Device Protocol Definitions - Extended settings per model
// Maps extended settings to TCP commands for each device model

import type { DeviceModel, ExtendedSettings, BaseExtendedSettings, MidExtendedSettings, AdvancedExtendedSettings, DualAxisExtendedSettings } from './device-types';
import { PROTOCOL_COMMANDS, DEFAULT_EXTENDED_SETTINGS } from './device-types';

export interface SettingField {
  key: string;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  command: string;
  formatValue: (val: any) => string;
  parseResponse: (data: string) => any;
}

export interface SelectSettingField {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  command: string;
}

// Common fields for all models
function getCommonFields(model: DeviceModel): SettingField[] {
  return [
    {
      key: 'acceleration', label: 'Ускорение', unit: '°/s²', min: 1, max: model === 'TL.0009' ? 100 : model === 'TL.0250' ? 200 : model === 'TL.0320' ? 500 : 500,
      step: 1, command: PROTOCOL_COMMANDS.SET_ACCELERATION,
      formatValue: (v) => `${v} ${v}`, // PAN TILT (same for non-dual)
      parseResponse: (d) => { const m = d.match(/ACC[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
    },
    {
      key: 'deceleration', label: 'Замедление', unit: '°/s²', min: 1, max: model === 'TL.0009' ? 100 : model === 'TL.0250' ? 200 : model === 'TL.0320' ? 500 : 500,
      step: 1, command: PROTOCOL_COMMANDS.SET_DECELERATION,
      formatValue: (v) => `${v} ${v}`,
      parseResponse: (d) => { const m = d.match(/DEC[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
    },
    {
      key: 'deadZone', label: 'Мёртвая зона', unit: '°', min: 0.01, max: 1.0,
      step: 0.01, command: PROTOCOL_COMMANDS.SET_DEADZONE,
      formatValue: (v) => String(v),
      parseResponse: (d) => { const m = d.match(/DZ[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
    },
    {
      key: 'autoParkTimeout', label: 'Авто-парковка', unit: 'с', min: 0, max: model === 'TL.0009' ? 600 : 7200,
      step: 10, command: PROTOCOL_COMMANDS.SET_AUTOPARK,
      formatValue: (v) => String(v),
      parseResponse: (d) => { const m = d.match(/APT[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
    },
    {
      key: 'backlashComp', label: 'Компенсация люфта', unit: '°', min: 0, max: model === 'TL.0009' ? 2.0 : 5.0,
      step: 0.01, command: PROTOCOL_COMMANDS.SET_BACKLASH,
      formatValue: (v) => String(v),
      parseResponse: (d) => { const m = d.match(/BC[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
    },
  ];
}

function getMidFields(): SettingField[] {
  return [
    {
      key: 'tempWarning', label: 'Темп. предупреждение', unit: '°C', min: 20, max: 80, step: 1,
      command: PROTOCOL_COMMANDS.SET_TEMP_WARN,
      formatValue: (v) => String(v),
      parseResponse: (d) => { const m = d.match(/TW[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
    },
    {
      key: 'tempShutdown', label: 'Темп. отключение', unit: '°C', min: 20, max: 90, step: 1,
      command: PROTOCOL_COMMANDS.SET_TEMP_SHUT,
      formatValue: (v) => String(v),
      parseResponse: (d) => { const m = d.match(/TS[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
    },
    {
      key: 'positionReportInterval', label: 'Интервал отчёта поз.', unit: 'мс', min: 50, max: 1000, step: 50,
      command: PROTOCOL_COMMANDS.SET_POS_REPORT,
      formatValue: (v) => String(v),
      parseResponse: (d) => { const m = d.match(/PRI[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
    },
  ];
}

function getAdvancedFields(): SettingField[] {
  return [
    ...getMidFields(),
    {
      key: 'inertialDamping', label: 'Инерционное демпфирование', unit: '', min: 0, max: 1, step: 0.01,
      command: PROTOCOL_COMMANDS.SET_DAMPING,
      formatValue: (v) => String(v),
      parseResponse: (d) => { const m = d.match(/DAMP[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
    },
    {
      key: 'motorCurrentLimit', label: 'Лимит тока мотора', unit: '%', min: 10, max: 100, step: 1,
      command: PROTOCOL_COMMANDS.SET_MOTOR_CURRENT,
      formatValue: (v) => String(v),
      parseResponse: (d) => { const m = d.match(/MCUR[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
    },
  ];
}

// Build extended settings command from settings object
export function buildExtendedCommand(model: DeviceModel, key: string, value: any): string | null {
  const cmdMap: Record<string, string> = {
    speedMode: `${PROTOCOL_COMMANDS.SET_SPEED_MODE} ${value}`,
    acceleration: `${PROTOCOL_COMMANDS.SET_ACCELERATION} ${value} ${value}`,
    deceleration: `${PROTOCOL_COMMANDS.SET_DECELERATION} ${value} ${value}`,
    deadZone: `${PROTOCOL_COMMANDS.SET_DEADZONE} ${value}`,
    azMin: `${PROTOCOL_COMMANDS.SET_LIMITS} ${value}`, // Full limits command built elsewhere
    azMax: '',
    elMin: '',
    elMax: '',
    autoParkTimeout: `${PROTOCOL_COMMANDS.SET_AUTOPARK} ${value}`,
    backlashComp: `${PROTOCOL_COMMANDS.SET_BACKLASH} ${value}`,
    tempWarning: `${PROTOCOL_COMMANDS.SET_TEMP_WARN} ${value}`,
    tempShutdown: `${PROTOCOL_COMMANDS.SET_TEMP_SHUT} ${value}`,
    errorRecovery: `${PROTOCOL_COMMANDS.SET_ERROR_RECOVERY} ${value}`,
    positionReportInterval: `${PROTOCOL_COMMANDS.SET_POS_REPORT} ${value}`,
    velocityFeedback: `${PROTOCOL_COMMANDS.SET_VEL_FEEDBACK} ${value ? '1' : '0'}`,
    inertialDamping: `${PROTOCOL_COMMANDS.SET_DAMPING} ${value}`,
    motorCurrentLimit: `${PROTOCOL_COMMANDS.SET_MOTOR_CURRENT} ${value}`,
    // TL.0400 specific
    tiltAcceleration: `${PROTOCOL_COMMANDS.SET_TILT_ACC} ${value}`,
    panAcceleration: `${PROTOCOL_COMMANDS.SET_PAN_ACC} ${value}`,
    tiltDeceleration: `${PROTOCOL_COMMANDS.SET_TILT_DEC} ${value}`,
    panDeceleration: `${PROTOCOL_COMMANDS.SET_PAN_DEC} ${value}`,
    tiltSpeedMode: `${PROTOCOL_COMMANDS.SET_TILT_SPEED_MODE} ${value}`,
    panSpeedMode: `${PROTOCOL_COMMANDS.SET_PAN_SPEED_MODE} ${value}`,
    syncMode: `${PROTOCOL_COMMANDS.SET_SYNC_MODE} ${value}`,
    syncRatio: `${PROTOCOL_COMMANDS.SET_SYNC_MODE} ${value}`,
  };

  return cmdMap[key] || null;
}

// Build the SET_LIM command with all 4 values
export function buildLimitsCommand(settings: ExtendedSettings): string {
  const s = settings as BaseExtendedSettings;
  return `${PROTOCOL_COMMANDS.SET_LIMITS} ${s.azMin} ${s.azMax} ${s.elMin} ${s.elMax}\r\n`;
}

// Build TL.0400 separate tilt/pan limits
export function buildDualLimitsCommand(settings: DualAxisExtendedSettings): { tilt: string; pan: string } {
  return {
    tilt: `${PROTOCOL_COMMANDS.SET_TILT_LIMITS} ${settings.elMin} ${settings.elMax}\r\n`,
    pan: `${PROTOCOL_COMMANDS.SET_PAN_LIMITS} ${settings.azMin} ${settings.azMax}\r\n`,
  };
}

// Get the full list of setting field definitions for a model
export function getSettingsFields(model: DeviceModel): { numeric: SettingField[]; select: SelectSettingField[]; dualAxis?: { numeric: SettingField[]; select: SelectSettingField[] } } {
  const common = getCommonFields(model);
  const speedModeOptions = model === 'TL.0320'
    ? [{ value: 'linear', label: 'Линейный' }, { value: 's-curve', label: 'S-кривая' }, { value: 'adaptive', label: 'Адаптивный' }]
    : [{ value: 'linear', label: 'Линейный' }, { value: 's-curve', label: 'S-кривая' }];

  const selectFields: SelectSettingField[] = [
    { key: 'speedMode', label: 'Режим скорости', options: speedModeOptions, command: PROTOCOL_COMMANDS.SET_SPEED_MODE },
  ];

  let numericFields: SettingField[] = [...common];

  if (model === 'TL.0250') {
    numericFields = [...common, ...getMidFields()];
    selectFields.push({
      key: 'errorRecovery', label: 'Восстановление после ошибки',
      options: [
        { value: 'none', label: 'Нет' },
        { value: 'retry', label: 'Повтор' },
        { value: 'homing', label: 'В исходное' },
      ],
      command: PROTOCOL_COMMANDS.SET_ERROR_RECOVERY,
    });
  }

  if (model === 'TL.0320') {
    numericFields = [...common, ...getAdvancedFields()];
    selectFields.push({
      key: 'errorRecovery', label: 'Восстановление после ошибки',
      options: [
        { value: 'none', label: 'Нет' },
        { value: 'retry', label: 'Повтор' },
        { value: 'homing', label: 'В исходное' },
        { value: 'safe-position', label: 'Безопасная позиция' },
      ],
      command: PROTOCOL_COMMANDS.SET_ERROR_RECOVERY,
    });
  }

  if (model === 'TL.0400') {
    numericFields = [...common, ...getAdvancedFields()];
    selectFields.push({
      key: 'errorRecovery', label: 'Восстановление после ошибки',
      options: [
        { value: 'none', label: 'Нет' },
        { value: 'retry', label: 'Повтор' },
        { value: 'homing', label: 'В исходное' },
        { value: 'safe-position', label: 'Безопасная позиция' },
      ],
      command: PROTOCOL_COMMANDS.SET_ERROR_RECOVERY,
    });

    const dualNumeric: SettingField[] = [
      {
        key: 'tiltAcceleration', label: 'Ускорение Tilt', unit: '°/s²', min: 1, max: 500, step: 1,
        command: PROTOCOL_COMMANDS.SET_TILT_ACC,
        formatValue: (v) => String(v),
        parseResponse: (d) => { const m = d.match(/ACC_T[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
      },
      {
        key: 'panAcceleration', label: 'Ускорение Pan', unit: '°/s²', min: 1, max: 500, step: 1,
        command: PROTOCOL_COMMANDS.SET_PAN_ACC,
        formatValue: (v) => String(v),
        parseResponse: (d) => { const m = d.match(/ACC_P[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
      },
      {
        key: 'tiltDeceleration', label: 'Замедление Tilt', unit: '°/s²', min: 1, max: 500, step: 1,
        command: PROTOCOL_COMMANDS.SET_TILT_DEC,
        formatValue: (v) => String(v),
        parseResponse: (d) => { const m = d.match(/DEC_T[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
      },
      {
        key: 'panDeceleration', label: 'Замедление Pan', unit: '°/s²', min: 1, max: 500, step: 1,
        command: PROTOCOL_COMMANDS.SET_PAN_DEC,
        formatValue: (v) => String(v),
        parseResponse: (d) => { const m = d.match(/DEC_P[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
      },
      {
        key: 'syncRatio', label: 'Коэфф. синхронизации', unit: '', min: 0.1, max: 10.0, step: 0.1,
        command: PROTOCOL_COMMANDS.SET_SYNC_MODE,
        formatValue: (v) => String(v),
        parseResponse: (d) => { const m = d.match(/SYNC[:\s]*([-\d.]+)/i); return m ? parseFloat(m[1]) : null; },
      },
    ];

    const dualSelect: SelectSettingField[] = [
      { key: 'tiltSpeedMode', label: 'Режим скорости Tilt', options: speedModeOptions, command: PROTOCOL_COMMANDS.SET_TILT_SPEED_MODE },
      { key: 'panSpeedMode', label: 'Режим скорости Pan', options: speedModeOptions, command: PROTOCOL_COMMANDS.SET_PAN_SPEED_MODE },
      {
        key: 'syncMode', label: 'Режим синхронизации',
        options: [
          { value: 'independent', label: 'Независимый' },
          { value: 'synchronized', label: 'Синхронный' },
          { value: 'master-slave', label: 'Master-Slave' },
        ],
        command: PROTOCOL_COMMANDS.SET_SYNC_MODE,
      },
    ];

    return { numeric: numericFields, select: selectFields, dualAxis: { numeric: dualNumeric, select: dualSelect } };
  }

  return { numeric: numericFields, select: selectFields };
}

// Get all extended settings for a model as a flat command list to send
export function getAllSettingsCommands(model: DeviceModel, settings: ExtendedSettings): string[] {
  const commands: string[] = [];
  const s = settings as any;

  // Speed mode
  if (model !== 'TL.0400' || !s.tiltSpeedMode) {
    commands.push(`${PROTOCOL_COMMANDS.SET_SPEED_MODE} ${s.speedMode}\r\n`);
  }

  // Acceleration/Deceleration
  if (model === 'TL.0400') {
    commands.push(`${PROTOCOL_COMMANDS.SET_TILT_ACC} ${s.tiltAcceleration}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_PAN_ACC} ${s.panAcceleration}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_TILT_DEC} ${s.tiltDeceleration}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_PAN_DEC} ${s.panDeceleration}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_TILT_SPEED_MODE} ${s.tiltSpeedMode}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_PAN_SPEED_MODE} ${s.panSpeedMode}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_SYNC_MODE} ${s.syncMode}\r\n`);
  } else {
    commands.push(`${PROTOCOL_COMMANDS.SET_ACCELERATION} ${s.acceleration} ${s.acceleration}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_DECELERATION} ${s.deceleration} ${s.deceleration}\r\n`);
  }

  // Common
  commands.push(`${PROTOCOL_COMMANDS.SET_DEADZONE} ${s.deadZone}\r\n`);
  commands.push(buildLimitsCommand(settings));
  commands.push(`${PROTOCOL_COMMANDS.SET_AUTOPARK} ${s.autoParkTimeout}\r\n`);
  commands.push(`${PROTOCOL_COMMANDS.SET_BACKLASH} ${s.backlashComp}\r\n`);

  // Mid+
  if ('tempWarning' in s) {
    commands.push(`${PROTOCOL_COMMANDS.SET_TEMP_WARN} ${s.tempWarning}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_TEMP_SHUT} ${s.tempShutdown}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_ERROR_RECOVERY} ${s.errorRecovery}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_POS_REPORT} ${s.positionReportInterval}\r\n`);
  }

  // Advanced+
  if ('inertialDamping' in s) {
    commands.push(`${PROTOCOL_COMMANDS.SET_DAMPING} ${s.inertialDamping}\r\n`);
    commands.push(`${PROTOCOL_COMMANDS.SET_MOTOR_CURRENT} ${s.motorCurrentLimit}\r\n`);
    if (s.velocityFeedback !== undefined) {
      commands.push(`${PROTOCOL_COMMANDS.SET_VEL_FEEDBACK} ${s.velocityFeedback ? '1' : '0'}\r\n`);
    }
  }

  return commands;
}

// Get model-specific info
export function getModelInfo(model: DeviceModel): {
  name: string;
  description: string;
  features: string[];
  maxSpeed: number;
  isDualAxis: boolean;
} {
  const info: Record<DeviceModel, { name: string; description: string; features: string[]; maxSpeed: number; isDualAxis: boolean }> = {
    'TL.0009': {
      name: 'TL.0009',
      description: 'Компактное ОПУ для лёгких нагрузок',
      features: ['Базовое управление', 'Линейный/S-кривая разгон', 'Ограничения позиций', 'Авто-парковка'],
      maxSpeed: 10,
      isDualAxis: false,
    },
    'TL.0250': {
      name: 'TL.0250',
      description: 'ОПУ среднего класса с расширенными функциями',
      features: ['Все функции TL.0009', 'Мониторинг температуры', 'Восстановление после ошибок', 'Настраиваемый интервал отчётов'],
      maxSpeed: 20,
      isDualAxis: false,
    },
    'TL.0320': {
      name: 'TL.0320',
      description: 'Продвинутое ОПУ с адаптивным управлением',
      features: ['Все функции TL.0250', 'Адаптивный режим скорости', 'Обратная связь по скорости', 'Инерционное демпфирование', 'Лимит тока мотора'],
      maxSpeed: 30,
      isDualAxis: false,
    },
    'TL.0400': {
      name: 'TL.0400',
      description: 'Высокоточное двухосевое ОПУ с раздельным управлением',
      features: ['Все функции TL.0320', 'Раздельные оси Tilt/Pan', 'Синхронное управление', 'Раздельные IP-адреса осей'],
      maxSpeed: 40,
      isDualAxis: true,
    },
  };
  return info[model];
}