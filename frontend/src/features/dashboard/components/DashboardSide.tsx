import { useMemo, useState } from 'react';
import { formatMoney, formatNumber, initials, relativeTime } from '@/lib/format';
import { Select } from '@/components/ui/Select/Select';
import type { ApiRecord } from '@/types/api';
import { dashboardPeriods, type DashboardPeriod } from './DashboardCharts';

type GoodsType = 'service' | 'package' | 'account_card' | 'product';
type GoodsMetric = 'revenue' | 'quantity';

const metricOptions: Array<{ value: GoodsMetric; label: string }> = [
  { value: 'revenue', label: 'Doanh thu thuần' },
  { value: 'quantity', label: 'Số lượng' },
];

const goodsTabs: Array<{ key: GoodsType; label: string }> = [
  { key: 'service', label: 'Dịch vụ' },
  { key: 'package', label: 'Gói dịch vụ, liệu trình' },
  { key: 'account_card', label: 'Thẻ tài khoản' },
  { key: 'product', label: 'Sản phẩm' },
];

export function TopGoods({ rows, period, onPeriodChange }: { rows: ApiRecord[]; period: DashboardPeriod; onPeriodChange: (period: DashboardPeriod) => void }) {
  const [itemType, setItemType] = useState<GoodsType>('service');
  const [metric, setMetric] = useState<GoodsMetric>('revenue');
  const visibleRows = useMemo(() => rows.filter((row) => row.itemType === itemType).sort((left, right) => Number(right[metric]) - Number(left[metric]) || Number(right.revenue) - Number(left.revenue)).slice(0, 5), [itemType, metric, rows]);

  return <article className="card team-card top-goods-card">
    <div className="team-header top-goods-header">
      <h2>Top 5 hàng hóa bán chạy</h2>
      <div className="ranking-controls">
        <Select<GoodsMetric>
          value={metric}
          onChange={setMetric}
          options={metricOptions}
          variant="bordered"
          size="sm"
          aria-label="Chỉ số xếp hạng"
        />
        <Select<DashboardPeriod>
          value={period}
          onChange={onPeriodChange}
          options={dashboardPeriods}
          size="sm"
          align="right"
          aria-label="Kỳ xếp hạng"
        />
      </div>
    </div>
    <div className="top-goods-tabs" role="tablist" aria-label="Loại hàng hóa">{goodsTabs.map((tab) => <button type="button" role="tab" aria-selected={itemType === tab.key} className={itemType === tab.key ? 'is-active' : ''} onClick={() => setItemType(tab.key)} key={tab.key}>{tab.label}</button>)}</div>
    <div className="top-goods-list">{visibleRows.length ? visibleRows.map((item, index) => <div className="top-goods-row" key={`${item.itemType}-${item.id}`}><strong>{index + 1}.</strong><span>{item.code}</span><span>{item.name}</span><strong>{metric === 'revenue' ? formatMoney(item.revenue) : formatNumber(item.quantity)}</strong></div>) : <div className="empty-inline top-goods-empty">Chưa có dữ liệu bán hàng trong tháng này.</div>}</div>
  </article>;
}

export function DashboardSide({ dashboard }: { dashboard: ApiRecord }) {
  return <aside className="dashboard-side" aria-label="Thông tin nhanh"><article className="card reminder-card"><h2>Nhắc việc</h2><h3>Chăm sóc khách hàng</h3><div className="reminder-item"><span className="reminder-icon orange"><i className="ph ph-user" /></span><span>Có <strong>{dashboard.reminders.customersInDebt} khách hàng</strong> đang có công nợ</span></div><h3>Hàng hóa</h3><div className="reminder-item"><span className="reminder-icon red"><i className="ph ph-cube" /></span><span>Có <strong>{dashboard.reminders.productsBelowStock} hàng hóa dưới</strong> và <strong>{dashboard.reminders.productsAboveStock} hàng hóa vượt</strong> định mức tồn</span></div></article><article className="card upcoming-card"><div className="side-card-header"><h2>Lịch hẹn chưa tới <span>{dashboard.upcomingAppointments.length}</span></h2></div><div className="upcoming-list">{dashboard.upcomingAppointments.length ? dashboard.upcomingAppointments.map((item: ApiRecord) => <div className="appointment-item" key={item.id}><span><strong>{item.customerName}</strong><small>{item.note || item.serviceName}</small></span><time>{item.time}</time></div>) : <div className="empty-inline">Không còn lịch hẹn nào trong ngày.</div>}</div></article><article className="card activity-card"><div className="side-card-header"><h2>Hoạt động gần đây</h2></div>{dashboard.activities.length ? dashboard.activities.map((activity: ApiRecord) => <div className="activity-item" key={activity.id}><span className={`activity-avatar ${activity.avatarTone}`}>{initials(activity.actorName)}</span><p><strong>{activity.actorName}</strong> {activity.description} {activity.objectCode && <span className="cell-main link">{activity.objectCode}</span>}<time>{relativeTime(activity.occurredAt)}</time></p></div>) : <div className="empty-inline">Chưa có hoạt động gần đây.</div>}</article></aside>;
}
