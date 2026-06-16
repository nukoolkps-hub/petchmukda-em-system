/* ─── Sortable employee cards ─────────────────────────────────────
   ใช้ใน SalaryAdminEdit — drag-reorder พนักงาน · optimistic local
   ลำดับ → sync ลง Firestore หลังลากเสร็จ · click ยังทำงานเป็น select
   (PointerSensor distance: 6 → ต้องลากเกิน 6px จึงเริ่ม drag) */

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Briefcase as IconBriefcase } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COLORS } from "../../constants";
import AvatarCircle from "../shared/AvatarCircle";

interface Props {
  employees: any[];
  selectedId: string;
  onSelect: (id: string) => void;
  onReorder?: (orderedIds: string[]) => Promise<unknown>;
  salaryData: Record<string, Record<string, any>>;
  selectedMonth: string;
}

export default function EmployeeCardGrid({
  employees,
  selectedId,
  onSelect,
  onReorder,
  salaryData,
  selectedMonth,
}: Props) {
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  // sync ลำดับจาก props เมื่อ employees เปลี่ยน — ทิ้ง localOrder ถ้ามี id
  // หายไป/เพิ่มใหม่ (เช่น Firestore sync มา)
  useEffect(() => {
    if (!localOrder) return;
    const fromProps = employees
      .map((e) => e.id)
      .sort()
      .join(",");
    const fromLocal = [...localOrder].sort().join(",");
    if (fromProps !== fromLocal) setLocalOrder(null);
  }, [employees, localOrder]);

  const orderedEmployees = useMemo(() => {
    if (!localOrder) return employees;
    const byId = new Map(employees.map((e) => [e.id, e]));
    return localOrder.map((id) => byId.get(id)).filter(Boolean);
  }, [employees, localOrder]);

  const ids: string[] = orderedEmployees.map((e) => e.id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    setLocalOrder(next);
    onReorder?.(next).catch((err) => {
      console.error("[reorderEmployees] failed:", err);
      setLocalOrder(null); // rollback ถ้า save fail
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mb-3.5">
          {orderedEmployees.map((employee) => {
            const monthData = salaryData[employee.id]?.[selectedMonth];
            const hasData = !!(
              monthData &&
              ((monthData.singleRatePieces || 0) > 0 ||
                (monthData.normalSalePieces || 0) > 0 ||
                (monthData.specialSalePieces || 0) > 0 ||
                (monthData.buyPieces || 0) > 0 ||
                (monthData.invitePieces || 0) > 0 ||
                (monthData.transferPieces || 0) > 0)
            );
            return (
              <SortableEmployeeCard
                key={employee.id}
                employee={employee}
                selected={employee.id === selectedId}
                hasData={hasData}
                onSelect={() => onSelect(employee.id)}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableEmployeeCard({ employee, selected, hasData, onSelect }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: employee.id });
  // จัดการ transition ที่ inline style เดียว — ไม่ใช้ Tailwind transition-*
  // กัน 2 transition rule applies ต่อ transform property พร้อมกัน
  // (เคยมี Tailwind class transition-transform + dnd-kit inline transition
  //  → drop animation อาจขัดกัน)
  //
  // 3 state:
  // - isDragging:     transition "none" → ตามนิ้วทันที
  // - drop animation: dnd-kit ส่ง transition prop มา → ใช้ตามนั้น
  // - idle (press):   fallback "transform 150ms ease-out" → active:scale smooth
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition || "transform 150ms ease-out",
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      {...attributes}
      {...listeners}
      style={style}
      className={`relative flex flex-col items-center gap-1.5 px-2 pt-3 pb-2.5 rounded-xl border-[1.5px] cursor-pointer font-[inherit] touch-none select-none [-webkit-touch-callout:none] [-webkit-user-select:none] ${
        isDragging ? "" : "active:scale-[1.03]"
      } ${
        selected
          ? "border-gold bg-gold-pale shadow-[0_2px_8px_rgba(201,151,58,0.25)]"
          : "border-bdr bg-white"
      } ${isDragging ? "opacity-80 scale-[1.06] shadow-[0_8px_22px_rgba(123,28,28,0.22)]" : ""}`}
    >
      <span
        aria-label={hasData ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
        title={hasData ? "บันทึกแล้ว" : "ยังไม่บันทึก"}
        className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border border-white shadow-sm ${
          hasData ? "bg-green" : "bg-txt-soft/40"
        }`}
      />
      <AvatarCircle
        avatar={employee.avatar}
        avatarType={employee.avatarType}
        avatarImageUrl={employee.avatarImageUrl}
        size={44}
        fontSize={14}
        border={`2px solid ${COLORS.gold}40`}
      />
      <div className="w-full min-w-0 text-center">
        <div
          className={`font-bold text-sm truncate leading-tight ${selected ? "text-maroon" : "text-txt"}`}
        >
          {employee.name}
        </div>
        <div className="text-xs text-txt-soft truncate leading-tight mt-0.5 inline-flex items-center gap-1">
          <IconBriefcase size={11} strokeWidth={2.4} />
          {employee.role || "-"}
        </div>
      </div>
    </button>
  );
}
