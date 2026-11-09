import { enableFamilyModeAction, enablePersonalDeviceAction } from "@/app/actions/family";
import { Icon } from "@/ui/icons";
import { buttonClass } from "@/ui/primitives";

/**
 * Menu bật thiết bị cho con (spec "Máy riêng của con"): máy dùng chung của gia đình, hoặc máy riêng
 * của một con. Dùng <details> nên mở được bằng bàn phím mà không cần JavaScript.
 */
export function DeviceMenu({ kids }: { kids: { id: number; name: string }[] }) {
  const item = "flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left font-extrabold text-ink hover:bg-soft focus-visible:outline-3 focus-visible:outline-ink";
  return (
    <details className="group relative">
      <summary className={buttonClass("primary", "md", "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
        <Icon name="phone" size={18} />
        Bật chế độ gia đình
      </summary>
      <div className="absolute right-0 z-40 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-2xl bg-card p-2 shadow-[0_8px_30px_rgb(0_0_0/0.18)]">
        <p className="px-3 pt-1 text-sm font-bold text-muted">Bật trên thiết bị này. Bạn sẽ được đăng xuất khỏi thiết bị này.</p>
        <form action={enableFamilyModeAction}>
          <button type="submit" className={item}>
            Máy dùng chung
            <span className="ml-auto text-sm font-bold text-muted">mọi con</span>
          </button>
        </form>
        {kids.map((k) => (
          <form key={k.id} action={enablePersonalDeviceAction}>
            <input type="hidden" name="childId" value={k.id} />
            <button type="submit" className={item}>
              Máy riêng của {k.name}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}
