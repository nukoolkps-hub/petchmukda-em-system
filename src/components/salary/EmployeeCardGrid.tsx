/* ─── Sortable employee cards ─────────────────────────────────────
   ใช้ใน SalaryAdminEdit — drag-reorder พนักงาน · optimistic local
   ลำดับ → sync ลง Firestore หลังลากเสร็จ · click ยังทำงานเป็น select
   (PointerSensor distance: 6 → ต้องลากเกิน 6px จึงเริ่ม drag)

   ใช้ DragOverlay: การ์ดที่ลากถูกโคลนเป็น overlay ลอยตามนิ้ว · ต้นฉบับใน
   กริดจางลง (placeholder) · ตอนวาง dnd-kit เล่น drop animation ลื่นๆ ลงช่อง
   ปลายทาง — กัน "กระตุก" จากการ reorder array พร้อมกับ animate transform   */

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
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

/** มีจำนวนชิ้น/ข้อมูลค่าคอมของเดือนนี้ไหม (รวม multi-item + legacy) */
function cardHasData(monthData?: Record<string, any> | null): boolean {
  const someValPositive = (m?: Record<string, unknown> | null) =>
    !!m && Object.values(m).some((v) => (Number(v) || 0) > 0);
  return !!(
    monthData &&
    ((monthData.singleRatePieces || 0) > 0 ||
      someValPositive(monthData.piecePieces) ||
      someValPositive(monthData.poolItemPieces) ||
      someValPositive(monthData.bonusCounts) ||
      (monthData.normalSalePieces || 0) > 0 ||
      (monthData.specialSalePieces || 0) > 0 ||
      (monthData.buyPieces || 0) > 0 ||
      (monthData.invitePieces || 0) > 0 ||
      (monthData.transferPieces || 0) > 0)
  );
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
  const [activeId, setActiveId] = useState<string | null>(null);

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
    setActiveId(null);
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

  const activeEmployee = activeId
    ? orderedEmployees.find((e) => e.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 mb-3.5">
          {orderedEmployees.map((employee) => (
            <SortableEmployeeCard
              key={employee.id}
              employee={employee}
              selected={employee.id === selectedId}
              hasData={cardHasData(salaryData[employee.id]?.[selectedMonth])}
              onSelect={() => onSelect(employee.id)}
            />
          ))}
        </div>
      </SortableContext>

      {/* overlay: การ์ดที่ลากลอยตามนิ้ว + drop animation ลื่น */}
      <DragOverlay>
        {activeEmployee ? (
          <EmployeeCardView
            employee={activeEmployee}
            selected={activeEmployee.id === selectedId}
            hasData={cardHasData(
              salaryData[activeEmployee.id]?.[selectedMonth],
            )}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* การ์ดที่ลากได้ (อยู่ในกริด) — ขณะลาก ต้นฉบับจางลงเป็น placeholder */
function SortableEmployeeCard({ employee, selected, hasData, onSelect }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: employee.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // ต้นฉบับขณะลาก → จางเป็น placeholder (overlay แสดงตัวจริงตามนิ้ว)
    opacity: isDragging ? 0.35 : 1,
  };
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      {...attributes}
      {...listeners}
      style={style}
      className={`relative flex flex-col items-center gap-1.5 px-2 pt-3 pb-2.5 rounded-xl border-[1.5px] cursor-pointer font-[inherit] touch-none select-none [-webkit-touch-callout:none] [-webkit-user-select:none] transition-transform duration-100 ${
        isDragging ? "" : "active:scale-[1.03]"
      } ${
        selected
          ? "border-gold bg-gold-pale shadow-[0_2px_8px_rgba(201,151,58,0.25)]"
          : "border-bdr bg-white"
      }`}
    >
      <CardInner employee={employee} selected={selected} hasData={hasData} />
    </button>
  );
}

/* การ์ดสำหรับ DragOverlay (static · ยกลอย) */
function EmployeeCardView({ employee, selected, hasData, overlay }: any) {
  return (
    <div
      className={`relative flex flex-col items-center gap-1.5 px-2 pt-3 pb-2.5 rounded-xl border-[1.5px] font-[inherit] select-none ${
        overlay ? "cursor-grabbing scale-[1.06]" : ""
      } ${
        selected ? "border-gold bg-gold-pale" : "border-bdr bg-white"
      } ${overlay ? "shadow-[0_10px_26px_rgba(123,28,28,0.28)]" : ""}`}
    >
      <CardInner employee={employee} selected={selected} hasData={hasData} />
    </div>
  );
}

/* เนื้อในการ์ด (ใช้ร่วม sortable + overlay) */
function CardInner({ employee, selected, hasData }: any) {
  return (
    <>
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
    </>
  );
}
