'use client';

import { useState, useEffect, useCallback } from 'react';
import { processesApi, formsApi, positionsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { BpmnDesigner, DEFAULT_BPMN_XML } from '@/components/bpmn/bpmn-designer';
import { FormBuilderPanel } from '@/components/forms/form-builder-panel';
import { TaskAssignmentModal } from '@/components/processes/task-assignment-modal';
import {
  ArrowRight,
  Save,
  Play,
  FileText,
  Variable,
  Plus,
  Edit3,
  Trash2,
} from 'lucide-react';

interface Props {
  processId?: string;
  onBack: () => void;
}

interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  variable?: string;
}

interface ProcessVariable {
  id?: string;
  name: string;
  label?: string;
  type: string;
}

type SidebarTab = 'forms' | 'variables';

export function ProcessDesignerView({ processId: initialProcessId, onBack }: Props) {
  const { toast } = useToast();
  const [currentProcessId, setCurrentProcessId] = useState<string | undefined>(initialProcessId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bpmnXml, setBpmnXml] = useState('');
  const [status, setStatus] = useState('DRAFT');

  const [forms, setForms] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [processVariables, setProcessVariables] = useState<ProcessVariable[]>([]);
  const [activeTab, setActiveTab] = useState<SidebarTab>('forms');

  const [editingForm, setEditingForm] = useState<any | null>(null);
  const [showFormBuilder, setShowFormBuilder] = useState(false);

  const [assignmentModalTask, setAssignmentModalTask] = useState<string | null>(null);

  const loadProcessData = useCallback(async (pid: string) => {
    const [proc, formsData, positionsData, userTasksData, existingAssignments, variablesData] =
      await Promise.all([
        processesApi.findOne(pid),
        formsApi.findAll(pid),
        positionsApi.findAll(),
        processesApi.getUserTasks(pid),
        processesApi.getAssignments(pid),
        processesApi.getVariables(pid),
      ]);
    setName(proc.name);
    setDescription(proc.description || '');
    setBpmnXml(proc.bpmnXml);
    setStatus(proc.status);
    setForms(formsData);
    setPositions(positionsData);
    setUserTasks(userTasksData);
    setProcessVariables(variablesData);
    const map: Record<string, any> = {};
    existingAssignments.forEach((a: any) => {
      map[a.taskName] = {
        positionId: a.positionId || '',
        assigneeId: a.assigneeId || '',
        formId: a.formId || '',
        selfService: a.selfService || false,
      };
    });
    setAssignments(map);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        if (initialProcessId) {
          await loadProcessData(initialProcessId);
          setCurrentProcessId(initialProcessId);
        } else {
          const draft = await processesApi.create({
            name: 'فرآیند جدید',
            bpmnXml: DEFAULT_BPMN_XML,
          });
          if (cancelled) return;
          setCurrentProcessId(draft.id);
          setName(draft.name);
          setBpmnXml(draft.bpmnXml);
          setStatus(draft.status);
          const [formsData, positionsData, userTasksData] = await Promise.all([
            formsApi.findAll(draft.id),
            positionsApi.findAll(),
            processesApi.getUserTasks(draft.id),
          ]);
          setForms(formsData);
          setPositions(positionsData);
          setUserTasks(userTasksData);
          setProcessVariables([]);
        }
      } catch (err: any) {
        toast({ title: 'خطا', description: err.message, variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [initialProcessId, loadProcessData, toast]);

  const formFieldVariables = forms.flatMap((f) =>
    (f.fields || []).map((field: FormField) => ({
      name: field.variable || field.name,
      type: field.type,
      formName: f.name,
      label: field.label,
    })),
  );

  const handleXmlChange = useCallback((xml: string) => {
    setBpmnXml(xml);
    const taskRegex =
      /<(?:bpmn:|bpmn2:)userTask\b([^>]*?)\/?>(?:[\s\S]*?<\/(?:bpmn:|bpmn2:)userTask>)?/g;
    const tasks: any[] = [];
    let match;
    while ((match = taskRegex.exec(xml)) !== null) {
      const attrs = match[1] || '';
      const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
      const taskName = (attrs.match(/\bname="([^"]*)"/) || [])[1] || id;
      if (id) tasks.push({ id, name: taskName });
    }
    setUserTasks(tasks);
  }, []);

  const handleSave = async () => {
    if (!currentProcessId || !name || !bpmnXml) {
      toast({ title: 'خطا', description: 'نام و طراحی فرآیند الزامی است', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await processesApi.update(currentProcessId, { name, description, bpmnXml });

      if (userTasks.length > 0) {
        const assignmentList = userTasks.map((ut) => ({
          taskName: ut.name,
          positionId: assignments[ut.name]?.positionId || undefined,
          assigneeId: assignments[ut.name]?.assigneeId || undefined,
          formId: assignments[ut.name]?.formId || undefined,
          selfService: assignments[ut.name]?.selfService || false,
        }));
        await processesApi.setAssignments(currentProcessId, assignmentList);
      }

      await processesApi.setVariables(currentProcessId, processVariables);

      toast({ title: 'موفقیت', description: 'فرآیند ذخیره شد' });
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!currentProcessId) return;
    try {
      await processesApi.update(currentProcessId, { status: 'ACTIVE' });
      setStatus('ACTIVE');
      toast({ title: 'موفقیت', description: 'فرآیند فعال شد' });
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    }
  };

  const updateAssignment = (taskName: string, field: string, value: any) => {
    setAssignments({
      ...assignments,
      [taskName]: { ...(assignments[taskName] || {}), [field]: value },
    });
  };

  const handleAssignmentFromContext = (element: any) => {
    const taskName = element.businessObject?.name || element.id;
    if (!taskName) return;
    setAssignmentModalTask(taskName);
  };

  const saveProcessVariables = async (vars: ProcessVariable[]) => {
    if (!currentProcessId) return;
    setProcessVariables(vars);
    try {
      await processesApi.setVariables(currentProcessId, vars);
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col" dir="rtl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowRight className="w-4 h-4 ml-2" />
            بازگشت
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نام فرآیند"
            className="w-64 h-9"
          />
          {status === 'ACTIVE' && (
            <Badge className="bg-green-100 text-green-800">فعال</Badge>
          )}
          {status === 'DRAFT' && (
            <Badge className="bg-gray-100 text-gray-600">پیش‌نویس</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentProcessId && status === 'DRAFT' && (
            <Button variant="outline" size="sm" onClick={handleActivate}>
              <Play className="w-4 h-4 ml-2" />
              فعال‌سازی
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            <Save className="w-4 h-4 ml-2" />
            {saving ? 'در حال ذخیره...' : 'ذخیره'}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <BpmnDesigner
            onXmlChange={handleXmlChange}
            initialXml={bpmnXml || undefined}
            onAssignmentAction={handleAssignmentFromContext}
          />
        </div>

        <div className="w-80 border-r border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
          <div className="flex border-b border-gray-200 bg-white">
            <button
              onClick={() => setActiveTab('forms')}
              className={`flex-1 px-3 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 ${
                activeTab === 'forms'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              فرم‌ها
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={`flex-1 px-3 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 ${
                activeTab === 'variables'
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Variable className="w-3.5 h-3.5" />
              متغیرها
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'forms' && (
              <FormsTab
                forms={forms}
                onEditForm={(form) => {
                  setEditingForm(form);
                  setShowFormBuilder(true);
                }}
                onNewForm={() => {
                  setEditingForm(null);
                  setShowFormBuilder(true);
                }}
              />
            )}
            {activeTab === 'variables' && (
              <VariablesTab
                processVariables={processVariables}
                formFieldVariables={formFieldVariables}
                onSave={saveProcessVariables}
              />
            )}
          </div>
        </div>
      </div>

      {showFormBuilder && currentProcessId && (
        <FormBuilderPanel
          form={editingForm}
          processId={currentProcessId}
          processVariables={processVariables}
          existingVariables={formFieldVariables.filter(
            (v) => !editingForm || v.formName !== editingForm.name,
          )}
          onProcessVariablesChange={setProcessVariables}
          onClose={() => setShowFormBuilder(false)}
          onSaved={async () => {
            setShowFormBuilder(false);
            const [formsData, variablesData] = await Promise.all([
              formsApi.findAll(currentProcessId),
              processesApi.getVariables(currentProcessId),
            ]);
            setForms(formsData);
            setProcessVariables(variablesData);
          }}
        />
      )}

      {assignmentModalTask && (
        <TaskAssignmentModal
          open={!!assignmentModalTask}
          taskName={assignmentModalTask}
          assignment={assignments[assignmentModalTask] || {}}
          positions={positions}
          forms={forms}
          onChange={(field, value) => updateAssignment(assignmentModalTask, field, value)}
          onClose={() => setAssignmentModalTask(null)}
        />
      )}
    </div>
  );
}

function FormsTab({
  forms,
  onEditForm,
  onNewForm,
}: {
  forms: any[];
  onEditForm: (form: any) => void;
  onNewForm: () => void;
}) {
  return (
    <div className="space-y-3">
      <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={onNewForm}>
        <Plus className="w-4 h-4 ml-2" />
        ایجاد فرم جدید
      </Button>
      {forms.length === 0 ? (
        <p className="text-center text-gray-400 text-xs py-4">هنوز فرمی ایجاد نشده</p>
      ) : (
        forms.map((form) => (
          <div
            key={form.id}
            className="p-3 bg-white rounded-lg border border-gray-200 hover:border-emerald-300 cursor-pointer"
            onClick={() => onEditForm(form)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{form.name}</p>
                <p className="text-xs text-gray-500">{form.fields?.length || 0} فیلد</p>
              </div>
              <Edit3 className="w-3.5 h-3.5 text-gray-400" />
            </div>
            {form.fields && form.fields.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {form.fields.slice(0, 4).map((f: any, i: number) => (
                  <Badge key={i} variant="secondary" className="text-[10px] font-mono" dir="ltr">
                    {f.variable || f.name}
                  </Badge>
                ))}
                {form.fields.length > 4 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{form.fields.length - 4}
                  </Badge>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function VariablesTab({
  processVariables,
  formFieldVariables,
  onSave,
}: {
  processVariables: ProcessVariable[];
  formFieldVariables: { name: string; type: string; formName: string; label: string }[];
  onSave: (vars: ProcessVariable[]) => void;
}) {
  const [vars, setVars] = useState(processVariables);
  const [newName, setNewName] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState('text');

  useEffect(() => {
    setVars(processVariables);
  }, [processVariables]);

  const typeColors: Record<string, string> = {
    text: 'bg-blue-100 text-blue-700',
    textarea: 'bg-purple-100 text-purple-700',
    number: 'bg-green-100 text-green-700',
    date: 'bg-orange-100 text-orange-700',
    select: 'bg-cyan-100 text-cyan-700',
    checkbox: 'bg-pink-100 text-pink-700',
  };

  const addVariable = () => {
    const name = newName.replace(/[^a-zA-Z0-9_]/g, '');
    if (!name) return;
    if (vars.some((v) => v.name === name)) return;
    const updated = [...vars, { name, label: newLabel || name, type: newType }];
    setVars(updated);
    onSave(updated);
    setNewName('');
    setNewLabel('');
    setNewType('text');
  };

  const removeVariable = (name: string) => {
    const updated = vars.filter((v) => v.name !== name);
    setVars(updated);
    onSave(updated);
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-2">
        <p className="text-xs font-medium text-gray-600">افزودن متغیر فرآیند</p>
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
          placeholder="نام متغیر (leaveType)"
          className="h-8 text-xs font-mono"
          dir="ltr"
        />
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="برچسب فارسی"
          className="h-8 text-xs"
        />
        <Select value={newType} onValueChange={setNewType}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">متن</SelectItem>
            <SelectItem value="number">عدد</SelectItem>
            <SelectItem value="date">تاریخ</SelectItem>
            <SelectItem value="select">لیست</SelectItem>
            <SelectItem value="checkbox">چک‌باکس</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={addVariable}>
          <Plus className="w-4 h-4 ml-2" />
          افزودن
        </Button>
      </div>

      {vars.length === 0 && formFieldVariables.length === 0 ? (
        <div className="text-center text-gray-400 py-4">
          <Variable className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">هنوز متغیری تعریف نشده</p>
        </div>
      ) : (
        <>
          {vars.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">متغیرهای فرآیند</p>
              {vars.map((v) => (
                <div key={v.name} className="p-2 bg-white rounded-lg border border-gray-200 flex items-center justify-between">
                  <div>
                    <code className="text-xs font-mono text-gray-800" dir="ltr">
                      {v.name}
                    </code>
                    <p className="text-xs text-gray-500">{v.label}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={`text-[10px] ${typeColors[v.type] || 'bg-gray-100 text-gray-600'}`}>
                      {v.type}
                    </Badge>
                    <button
                      onClick={() => removeVariable(v.name)}
                      className="p-1 hover:bg-red-50 text-red-600 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {formFieldVariables.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">متغیرهای فرم‌ها</p>
              {formFieldVariables.map((v, i) => (
                <div key={i} className="p-2 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono text-gray-800" dir="ltr">
                      {v.name}
                    </code>
                    <Badge className={`text-[10px] ${typeColors[v.type] || 'bg-gray-100 text-gray-600'}`}>
                      {v.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {v.label} — {v.formName}
                  </p>
                </div>
              ))}
            </div>
          )}

          {(vars.length > 0 || formFieldVariables.length > 0) && (
            <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
              <p className="font-medium mb-1">مثال استفاده در دروازه:</p>
              <code dir="ltr" className="text-[11px] block bg-white p-2 rounded mt-1">
                environment.variables.{vars[0]?.name || formFieldVariables[0]?.name} === 'value'
              </code>
            </div>
          )}
        </>
      )}
    </div>
  );
}
