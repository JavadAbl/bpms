'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { processesApi, formsApi, positionsApi, usersApi } from '@/lib/api';
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
import { validateConditionXml } from '@/lib/condition-validation';
import { BpmnDesigner, DEFAULT_BPMN_XML } from '@/components/bpmn/bpmn-designer';
import { FormBuilderPanel } from '@/components/forms/form-builder-panel';
import { TaskAssignmentModal } from '@/components/processes/task-assignment-modal';
import { ProcessStartersModal } from '@/components/processes/process-starters-modal';
import { ProcessVersionsDialog } from '@/components/processes/process-versions-dialog';
import {
  GatewayConditionModal,
  type ConditionVariable,
} from '@/components/processes/gateway-condition-modal';
import { useCategories } from '@/hooks/use-categories';
import {
  ArrowRight,
  Save,
  Play,
  FileText,
  Variable,
  Plus,
  Edit3,
  Trash2,
  History,
  Users,
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
  categoryId?: string;
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
  const router = useRouter();
  const { categories } = useCategories();
  const [currentProcessId, setCurrentProcessId] = useState<string | undefined>(initialProcessId);
  // "new" mode: nothing exists on the server yet — the process row is created
  // ONLY when the user presses ذخیره inside the designer (v4 requirement).
  const isNewMode = !currentProcessId;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [bpmnXml, setBpmnXml] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const [processVersion, setProcessVersion] = useState(1);
  const [versionsOpen, setVersionsOpen] = useState(false);
  // Bump to force-remount the modeler with fresh XML (e.g. after a version restore)
  const [designerNonce, setDesignerNonce] = useState(0);

  const [forms, setForms] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userTasks, setUserTasks] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>>({});
  const [processVariables, setProcessVariables] = useState<ProcessVariable[]>([]);
  const [activeTab, setActiveTab] = useState<SidebarTab>('forms');

  // ---- process starters (شروع‌کنندگان مجاز) — staged locally, applied on Save ----
  const [starterIds, setStarterIds] = useState<string[]>([]);
  const [startersRestricted, setStartersRestricted] = useState(false);
  const [startersModalOpen, setStartersModalOpen] = useState(false);

  const [editingForm, setEditingForm] = useState<any | null>(null);
  const [showFormBuilder, setShowFormBuilder] = useState(false);

  const [assignmentModalTask, setAssignmentModalTask] = useState<string | null>(null);

  const [conditionTarget, setConditionTarget] = useState<{ element: any; modeler: any } | null>(
    null,
  );

  const handleConditionAction = useCallback((element: any, modeler: any) => {
    setConditionTarget({ element, modeler });
  }, []);

  const loadProcessData = useCallback(async (pid: string) => {
    const [proc, formsData, positionsData, usersData, userTasksData, existingAssignments, variablesData] =
      await Promise.all([
        processesApi.findOne(pid),
        formsApi.findAll(pid),
        positionsApi.findAll(),
        usersApi.findAll(),
        processesApi.getUserTasks(pid),
        processesApi.getAssignments(pid),
        processesApi.getVariables(pid),
      ]);
    setName(proc.name);
    setDescription(proc.description || '');
    setBpmnXml(proc.bpmnXml);
    setStatus(proc.status);
    setProcessVersion(proc.version || 1);
    setForms(formsData);
    setPositions(positionsData);
    setUsers(usersData);
    setUserTasks(userTasksData);
    setProcessVariables(variablesData);
    // Process starters — empty list means every user may start
    const serverStarters: string[] = (proc.starters || []).map((s: any) => s.userId);
    setStarterIds(serverStarters);
    setStartersRestricted(serverStarters.length > 0);
    const map: Record<string, any> = {};
    existingAssignments.forEach((a: any) => {
      map[a.taskName] = {
        strategy: a.strategy || (a.assigneeId ? 'FIXED_USER' : a.positionId ? 'POSITION' : 'FIXED_USER'),
        sourceTaskName: a.sourceTaskName || '',
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
          // "new" mode — NOTHING is created on the server here. The process row
          // is created only when the user presses «ذخیره» (see handleSave).
          setName('');
          setDescription('');
          setBpmnXml(DEFAULT_BPMN_XML);
          setStatus('DRAFT');
          setProcessVersion(1);
          setStarterIds([]);
          setStartersRestricted(false);
          const [positionsData, usersData] = await Promise.all([
            positionsApi.findAll(),
            usersApi.findAll(),
          ]);
          if (cancelled) return;
          setPositions(positionsData);
          setUsers(usersData);
          setForms([]);
          setProcessVariables([]);
          setAssignments({});
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

  // Resolve the selectable options of a form field the SAME WAY the runtime
  // dynamic-form does: a categoryId wins (global list with Persian labels),
  // otherwise the field's inline options. This keeps the no-code condition
  // builder in sync with what end users actually see in task forms.
  const resolveFieldOptions = useCallback(
    (field: FormField): { value: string; label: string }[] => {
      if (field.categoryId) {
        const cat = categories.find((c) => c.id === field.categoryId);
        if (cat?.items?.length) {
          return cat.items.map((it) => ({ value: it.value, label: it.label }));
        }
      }
      return (field.options || []).map((o) => ({ value: o, label: o }));
    },
    [categories],
  );

  const formFieldVariables = forms.flatMap((f) =>
    (f.fields || []).map((field: FormField) => ({
      name: field.variable || field.name,
      type: field.type,
      formName: f.name,
      label: field.label,
      options: resolveFieldOptions(field),
    })),
  );

  // Merged, de-duplicated variables available to gateway conditions.
  // A declared process variable wins on label/type, but it is ENRICHED with
  // the selectable options of a same-named form field — so the no-code
  // condition builder offers the same dropdown values the runtime form shows
  // (category-backed when the field references one).
  const conditionVariables: ConditionVariable[] = (() => {
    const map = new Map<string, ConditionVariable>();
    processVariables.forEach((v) => map.set(v.name, { name: v.name, label: v.label, type: v.type }));
    formFieldVariables.forEach((v) => {
      const declared = map.get(v.name);
      if (declared) {
        if (v.options?.length && !(declared.options?.length)) {
          declared.options = v.options;
        }
        return;
      }
      map.set(v.name, { name: v.name, label: v.label, type: v.type, options: v.options });
    });
    return [...map.values()];
  })();

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
    if (!name || !bpmnXml) {
      toast({ title: 'خطا', description: 'نام و طراحی فرآیند الزامی است', variant: 'destructive' });
      return;
    }
    // Save-time gate: reject XML whose gateway conditions the engine would
    // mis-evaluate (same rules as the backend — defense in depth)
    const conditionIssues = validateConditionXml(bpmnXml);
    if (conditionIssues.length > 0) {
      toast({
        title: 'ذخیره انجام نشد — شرط نامعتبر',
        description: conditionIssues.map((i) => i.message).join('؛ '),
        variant: 'destructive',
        duration: 10000,
      });
      return;
    }
    setSaving(true);
    try {
      if (!currentProcessId) {
        // ---- "new" mode: THIS is the only place a process row gets created ----
        const finalStarterIds = startersRestricted ? starterIds : [];
        if (finalStarterIds.length === 0 && startersRestricted) {
          toast({
            title: 'خطا',
            description: 'اگر شروع فرآیند محدود است، حداقل یک کاربر را انتخاب کنید',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
        const created = await processesApi.create({
          name,
          description,
          bpmnXml,
          starterIds: finalStarterIds,
        });
        setCurrentProcessId(created.id);
        setStatus(created.status || 'DRAFT');
        setProcessVersion(created.version || 1);
        // Apply the staged designer state to the freshly created process
        if (userTasks.length > 0) {
          await processesApi.setAssignments(
            created.id,
            userTasks.map((ut) => ({
              taskName: ut.name,
              strategy: assignments[ut.name]?.strategy || 'FIXED_USER',
              sourceTaskName: assignments[ut.name]?.sourceTaskName || undefined,
              positionId: assignments[ut.name]?.positionId || undefined,
              assigneeId: assignments[ut.name]?.assigneeId || undefined,
              formId: assignments[ut.name]?.formId || undefined,
              selfService: assignments[ut.name]?.selfService || false,
            })),
          );
        }
        if (processVariables.length > 0) {
          await processesApi.setVariables(created.id, processVariables);
        }
        // Swap the URL to the real process id so a refresh keeps the designer
        // in edit mode (same dynamic route — no remount, state preserved).
        router.replace(`/processes/${created.id}/design`);
        toast({ title: 'موفقیت', description: 'فرآیند ایجاد و ذخیره شد' });
      } else {
        // ---- edit mode: PATCH (new version row only when XML really changed) ----
        const updated = await processesApi.update(currentProcessId, { name, description, bpmnXml });
        setProcessVersion(updated.version || processVersion);

        if (userTasks.length > 0) {
          const assignmentList = userTasks.map((ut) => ({
            taskName: ut.name,
            strategy: assignments[ut.name]?.strategy || 'FIXED_USER',
            sourceTaskName: assignments[ut.name]?.sourceTaskName || undefined,
            positionId: assignments[ut.name]?.positionId || undefined,
            assigneeId: assignments[ut.name]?.assigneeId || undefined,
            formId: assignments[ut.name]?.formId || undefined,
            selfService: assignments[ut.name]?.selfService || false,
          }));
          await processesApi.setAssignments(currentProcessId, assignmentList);
        }

        await processesApi.setVariables(currentProcessId, processVariables);

        // Starters are process-level config (not versioned) — apply on save
        await processesApi.setStarters(
          currentProcessId,
          startersRestricted ? starterIds : [],
        );

        toast({ title: 'موفقیت', description: 'فرآیند ذخیره شد' });
      }
    } catch (err: any) {
      toast({ title: 'خطا', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!currentProcessId) return;
    // Same gate as save: activation with broken conditions would hang/misroute instances
    const conditionIssues = bpmnXml ? validateConditionXml(bpmnXml) : [];
    if (conditionIssues.length > 0) {
      toast({
        title: 'فعال‌سازی انجام نشد — شرط نامعتبر',
        description: conditionIssues.map((i) => i.message).join('؛ '),
        variant: 'destructive',
        duration: 10000,
      });
      return;
    }
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
    if (!currentProcessId) {
      // "new" mode — keep locally; applied when the process is created on Save
      setProcessVariables(vars);
      return;
    }
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
    <div className="fixed inset-0 bg-background z-50 flex flex-col" dir="rtl">
      {/* MD3 top app bar — elevated surface, tonal version chip, pill actions */}
      <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/70 bg-card shadow-elev-1 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowRight className="w-4 h-4 ml-2" />
            بازگشت
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="نام فرآیند (الزامی)"
            className="w-64 h-9 bg-muted/60 border-border/60 focus-visible:bg-card"
          />
          {isNewMode && (
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات (اختیاری)"
              className="w-56 h-9 bg-muted/60 border-border/60 focus-visible:bg-card hidden lg:block"
            />
          )}
          {isNewMode && (
            <Badge className="bg-primary-container text-on-primary-container border-transparent">
              ایجاد جدید — هنوز ذخیره نشده
            </Badge>
          )}
          {status === 'ACTIVE' && !isNewMode && (
            <Badge className="bg-success/15 text-success border-transparent">فعال</Badge>
          )}
          {status === 'DRAFT' && !isNewMode && (
            <Badge className="bg-muted text-muted-foreground border-transparent">پیش‌نویس</Badge>
          )}
          {/* Starters chip — click to edit who may start instances of this process */}
          <button
            onClick={() => setStartersModalOpen(true)}
            title="تعیین کاربران مجاز به شروع فرآیند"
            className={`state-layer inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium cursor-pointer transition-shadow hover:shadow-elev-1 ${
              startersRestricted
                ? 'bg-warning/15 text-warning'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {startersRestricted
              ? `شروع: ${starterIds.length.toLocaleString('fa-IR')} کاربر`
              : 'شروع: همه کاربران'}
          </button>
          {currentProcessId && (
            <button
              onClick={() => setVersionsOpen(true)}
              title="تاریخچه نسخه‌ها"
              className="state-layer inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary-container text-on-primary-container text-xs font-medium cursor-pointer transition-shadow hover:shadow-elev-1"
            >
              <History className="w-3.5 h-3.5" />
              نسخه {processVersion}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentProcessId && status === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleActivate}
              className="border-success/40 text-success hover:bg-success/10 hover:text-success"
            >
              <Play className="w-4 h-4 ml-2" />
              فعال‌سازی
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 ml-2" />
            {saving
              ? 'در حال ذخیره...'
              : isNewMode
                ? 'ایجاد و ذخیره'
                : 'ذخیره'}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <BpmnDesigner
            key={designerNonce}
            onXmlChange={handleXmlChange}
            initialXml={bpmnXml || undefined}
            onAssignmentAction={handleAssignmentFromContext}
            onConditionAction={handleConditionAction}
            onStartersAction={() => setStartersModalOpen(true)}
          />
        </div>

        <div className="w-80 border-r border-border/70 bg-muted/40 flex flex-col overflow-hidden">
          {/* MD3 pill tabs */}
          <div className="flex items-center gap-1 p-2 border-b border-border/70 bg-card">
            <button
              onClick={() => setActiveTab('forms')}
              className={`state-layer flex-1 h-8 px-3 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'forms'
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              فرم‌ها
            </button>
            <button
              onClick={() => setActiveTab('variables')}
              className={`state-layer flex-1 h-8 px-3 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === 'variables'
                  ? 'bg-primary-container text-on-primary-container'
                  : 'text-muted-foreground hover:text-foreground'
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
                disabled={isNewMode}
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
          users={users}
          forms={forms}
          tasks={userTasks}
          onChange={(field, value) => updateAssignment(assignmentModalTask, field, value)}
          onClose={() => setAssignmentModalTask(null)}
        />
      )}

      {startersModalOpen && (
        <ProcessStartersModal
          open={startersModalOpen}
          users={users}
          restricted={startersRestricted}
          starterIds={starterIds}
          onChange={(restricted, ids) => {
            setStartersRestricted(restricted);
            setStarterIds(ids);
          }}
          onClose={() => setStartersModalOpen(false)}
        />
      )}

      {conditionTarget && (
        <GatewayConditionModal
          open
          element={conditionTarget.element}
          modeler={conditionTarget.modeler}
          variables={conditionVariables}
          onClose={() => setConditionTarget(null)}
        />
      )}

      {currentProcessId && (
        <ProcessVersionsDialog
          open={versionsOpen}
          processId={currentProcessId}
          processName={name}
          currentVersion={processVersion}
          onClose={() => setVersionsOpen(false)}
          onRestored={(proc) => {
            // Restore changed the current XML under us — reload it into the canvas
            setBpmnXml(proc.bpmnXml);
            setProcessVersion(proc.version || processVersion + 1);
            setDesignerNonce((n) => n + 1);
            toast({ title: 'بازگردانی انجام شد', description: `نسخه ${proc.version} به‌عنوان نسخه فعلی ذخیره شد` });
          }}
        />
      )}
    </div>
  );
}

function FormsTab({
  forms,
  disabled,
  onEditForm,
  onNewForm,
}: {
  forms: any[];
  /** "new" mode: the process row does not exist yet — forms need a processId */
  disabled?: boolean;
  onEditForm: (form: any) => void;
  onNewForm: () => void;
}) {
  return (
    <div className="space-y-3">
      <Button size="sm" className="w-full" onClick={onNewForm} disabled={disabled}>
        <Plus className="w-4 h-4 ml-2" />
        ایجاد فرم جدید
      </Button>
      {disabled && (
        <p className="text-[11px] text-warning bg-warning/10 border border-warning/25 rounded-lg px-2.5 py-2 leading-relaxed">
          برای ساخت فرم، ابتدا فرآیند را با دکمه «ایجاد و ذخیره» ذخیره کنید.
        </p>
      )}
      {forms.length === 0 ? (
        <div className="text-center py-6">
          <FileText className="size-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground/80">هنوز فرمی ایجاد نشده</p>
        </div>
      ) : (
        forms.map((form) => (
          <div
            key={form.id}
            className="p-3 bg-card rounded-xl border border-border/60 hover:border-primary/50 hover:shadow-elev-1 cursor-pointer transition-all"
            onClick={() => onEditForm(form)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{form.name}</p>
                <p className="text-xs text-muted-foreground">{form.fields?.length || 0} فیلد</p>
              </div>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Edit3 className="w-3.5 h-3.5" />
              </span>
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
    text: 'bg-primary/15 text-primary',
    textarea: 'bg-primary-container text-on-primary-container',
    number: 'bg-success/15 text-success',
    date: 'bg-warning/15 text-warning',
    select: 'bg-primary/15 text-primary',
    checkbox: 'bg-destructive/10 text-destructive',
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
      <div className="p-3 bg-card rounded-xl border border-border/60 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">افزودن متغیر فرآیند</p>
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
        <Button size="sm" className="w-full" onClick={addVariable}>
          <Plus className="w-4 h-4 ml-2" />
          افزودن
        </Button>
      </div>

      {vars.length === 0 && formFieldVariables.length === 0 ? (
        <div className="text-center text-muted-foreground/80 py-4">
          <Variable className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">هنوز متغیری تعریف نشده</p>
        </div>
      ) : (
        <>
          {vars.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">متغیرهای فرآیند</p>
              {vars.map((v) => (
                <div key={v.name} className="p-2.5 bg-card rounded-xl border border-border/60 flex items-center justify-between">
                  <div>
                    <code className="text-xs font-mono text-foreground" dir="ltr">
                      {v.name}
                    </code>
                    <p className="text-xs text-muted-foreground">{v.label}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={`text-[10px] ${typeColors[v.type] || 'bg-muted text-muted-foreground'}`}>
                      {v.type}
                    </Badge>
                    <button
                      onClick={() => removeVariable(v.name)}
                      className="p-1 hover:bg-destructive/10 text-destructive rounded"
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
              <p className="text-xs text-muted-foreground">متغیرهای فرم‌ها</p>
              {formFieldVariables.map((v, i) => (
                <div key={i} className="p-2.5 bg-card rounded-xl border border-border/60">
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono text-foreground" dir="ltr">
                      {v.name}
                    </code>
                    <Badge className={`text-[10px] ${typeColors[v.type] || 'bg-muted text-muted-foreground'}`}>
                      {v.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {v.label} — {v.formName}
                  </p>
                </div>
              ))}
            </div>
          )}

          {(vars.length > 0 || formFieldVariables.length > 0) && (
            <div className="p-3 bg-primary/8 dark:bg-primary/12 rounded-xl text-xs text-primary">
              <p className="font-medium mb-1">استفاده در شرط دروازه:</p>
              <p className="leading-5">
                روی دروازه انحصاری راست‌کلیک کنید و «مدیریت شرط‌ها» را انتخاب کنید؛ شرط‌ها به
                صورت <span dir="ltr" className="font-mono">next(null, …)</span> روی فلش‌های خروجی ذخیره
                می‌شوند. نمونه عبارت:
              </p>
              <code dir="ltr" className="text-[11px] block bg-card p-2 rounded-lg mt-1.5 font-mono">
                environment.variables.{vars[0]?.name || formFieldVariables[0]?.name} === 'value'
              </code>
            </div>
          )}
        </>
      )}
    </div>
  );
}
