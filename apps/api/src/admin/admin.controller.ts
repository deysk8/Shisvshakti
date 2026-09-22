import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { AnalyticsService } from '../analytics/analytics.service';
import { CouponsService } from '../coupons/coupons.service';
import { FleetService } from '../fleet/fleet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RoutesService } from '../routes/routes.service';
import { SchedulesService } from '../schedules/schedules.service';
import { AdminService } from './admin.service';
import { RestoreRouteDateDto } from './dto/restore-route-date.dto';
import { CancelRouteDateDto } from './dto/cancel-route-date.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { CreateAgentDto } from './dto/create-agent.dto';
import { CreateBusDto } from './dto/create-bus.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { CreateCouponDto } from '../coupons/dto/create-coupon.dto';
import { UpsertFareRuleDto } from './dto/upsert-fare-rule.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { UpsertTripSeatPricingDto } from './dto/upsert-trip-seat-pricing.dto';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteFullDto } from './dto/update-route-full.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { AssignRouteBusDto } from './dto/assign-route-bus.dto';
import { ReassignScheduleBusDto } from './dto/reassign-schedule-bus.dto';
import { UpdateBusCrewDto } from './dto/update-bus-crew.dto';
import { PricingService } from '../pricing/pricing.service';
import { PartnerChannelsService } from '../partner/partner-channels.service';
import { PartnerWebhooksService } from '../partner/partner-webhooks.service';
import { UpdatePartnerChannelDto } from '../partner/dto/partner.dto';
@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private fleetService: FleetService,
    private routesService: RoutesService,
    private schedulesService: SchedulesService,
    private analyticsService: AnalyticsService,
    private notifications: NotificationsService,
    private coupons: CouponsService,
    private pricing: PricingService,
    private partnerChannels: PartnerChannelsService,
    private partnerWebhooks: PartnerWebhooksService,
  ) {}

  @Get('analytics/overview')
  analyticsOverview(@Query('days') days?: string) {
    const parsed = days ? parseInt(days, 10) : 14;
    return this.analyticsService.getOverview(Number.isFinite(parsed) ? parsed : 14);
  }

  @Get('analytics/recent-bookings')
  recentBookings(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 20;
    return this.analyticsService.getRecentBookings(Number.isFinite(parsed) ? parsed : 20);
  }

  @Get('analytics/agents')
  agentPerformance(@Query('days') days?: string) {
    const parsed = days ? parseInt(days, 10) : 30;
    return this.analyticsService.getAgentPerformance(Number.isFinite(parsed) ? parsed : 30);
  }

  @Get('analytics/upcoming-trips')
  upcomingTripsAnalytics(@Query('days') days?: string) {
    const parsed = days ? parseInt(days, 10) : 14;
    return this.analyticsService.getUpcomingTripsAnalytics(Number.isFinite(parsed) ? parsed : 14);
  }

  @Get('analytics/export')
  async exportAnalytics(@Query('days') days: string | undefined, @Res() res: Response) {
    const parsed = days ? parseInt(days, 10) : 14;
    const windowDays = Number.isFinite(parsed) ? parsed : 14;
    const csv = await this.analyticsService.buildExportCsv(windowDays);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="shiv-shakti-analytics-${stamp}.csv"`);
    res.send(`\uFEFF${csv}`);
  }

  @Get('agents')
  listAgents() {
    return this.adminService.listAgents();
  }

  @Post('agents')
  createAgent(@Body() dto: CreateAgentDto) {
    return this.adminService.createAgent(dto);
  }

  @Patch('agents/:id')
  updateAgent(@Param('id') id: string, @Body() dto: UpdateAgentDto) {
    return this.adminService.updateAgent(id, dto);
  }

  @Delete('agents/:id')
  deactivateAgent(@Param('id') id: string) {
    return this.adminService.deactivateAgent(id);
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getCompanySettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateCompanySettingsDto) {
    return this.adminService.updateCompanySettings(dto);
  }

  @Get('trips')
  listTrips(@Query('days') days?: string) {
    const parsed = days ? parseInt(days, 10) : 14;
    return this.schedulesService.listUpcomingTrips(Number.isFinite(parsed) ? parsed : 14);
  }

  @Patch('trips/:tripId/cancel')
  cancelTrip(@Param('tripId') tripId: string, @Body() dto: CancelTripDto) {
    return this.schedulesService.cancelTrip(
      tripId,
      dto.reason,
      dto.refundPassengers ?? true,
    );
  }

  @Post('routes/:routeId/cancel-date')
  cancelRouteForDate(@Param('routeId') routeId: string, @Body() dto: CancelRouteDateDto) {
    return this.schedulesService.cancelRouteForDate(
      routeId,
      dto.serviceDate,
      dto.reason,
      dto.refundPassengers ?? true,
    );
  }

  @Post('routes/:routeId/restore-date')
  restoreRouteForDate(@Param('routeId') routeId: string, @Body() dto: RestoreRouteDateDto) {
    return this.schedulesService.restoreRouteForDate(routeId, dto.serviceDate);
  }

  @Patch('trips/:tripId/restore')
  restoreTrip(@Param('tripId') tripId: string) {
    return this.schedulesService.restoreTrip(tripId);
  }

  @Get('buses')
  listBuses() {
    return this.fleetService.listBuses();
  }

  @Get('buses/crew')
  listBusCrew() {
    return this.fleetService.listBusCrewBoard();
  }

  @Patch('buses/:id/crew')
  updateBusCrew(@Param('id') id: string, @Body() dto: UpdateBusCrewDto) {
    return this.fleetService.updateBusCrew(id, dto);
  }

  @Post('buses')
  createBus(@Body() dto: CreateBusDto) {
    return this.fleetService.createBus(dto);
  }

  @Patch('buses/:id/status')
  updateBusStatus(@Param('id') id: string, @Body('status') status: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED') {
    return this.fleetService.updateBusStatus(id, status);
  }

  @Get('routes')
  listRoutes() {
    return this.routesService.listRoutes();
  }

  @Get('routes/management')
  listRoutesForManagement() {
    return this.routesService.listRoutesForAdmin();
  }

  @Post('routes')
  createRoute(@Body() dto: CreateRouteDto) {
    return this.adminService.createRoute(dto);
  }

  @Get('bus-types')
  listBusTypes() {
    return this.fleetService.listBusTypes();
  }

  @Patch('routes/:routeId')
  async updateRouteStatus(@Param('routeId') routeId: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.setRouteActive(routeId, dto.isActive);
  }

  @Put('routes/:routeId')
  updateRoute(@Param('routeId') routeId: string, @Body() dto: UpdateRouteFullDto) {
    return this.adminService.updateRoute(routeId, dto);
  }

  @Post('routes/:routeId/assign-bus')
  async assignBusToRoute(@Param('routeId') routeId: string, @Body() dto: AssignRouteBusDto) {
    const baseFare =
      dto.baseFare ?? (await this.routesService.resolveDefaultBaseFare(routeId));
    return this.schedulesService.assignBusToRoute({
      routeId,
      busId: dto.busId,
      departureTime: dto.departureTime,
      baseFare,
      daysAhead: dto.daysAhead,
    });
  }

  @Get('routes/:routeId/fares')
  listFares(@Param('routeId') routeId: string) {
    return this.routesService.listFareRules(routeId);
  }

  @Put('routes/:routeId/fares')
  upsertFare(@Param('routeId') routeId: string, @Body() dto: UpsertFareRuleDto) {
    return this.routesService.upsertFareRule(routeId, dto);
  }

  @Delete('routes/:routeId/fares/:fromSequence/:toSequence')
  deleteFare(
    @Param('routeId') routeId: string,
    @Param('fromSequence') fromSequence: string,
    @Param('toSequence') toSequence: string,
  ) {
    return this.routesService.deleteFareRule(routeId, parseInt(fromSequence, 10), parseInt(toSequence, 10));
  }

  @Get('trips/:tripId/seat-pricing')
  getTripSeatPricing(
    @Param('tripId') tripId: string,
    @Query('fromSequence') fromSequence: string,
    @Query('toSequence') toSequence: string,
  ) {
    return this.pricing.getAdminSeatPricingBoard(
      tripId,
      parseInt(fromSequence, 10),
      parseInt(toSequence, 10),
    );
  }

  @Put('trips/:tripId/seat-pricing')
  upsertTripSeatPricing(@Param('tripId') tripId: string, @Body() dto: UpsertTripSeatPricingDto) {
    return this.pricing.upsertTripSeatOverrides(tripId, dto.fromSequence, dto.toSequence, dto.overrides);
  }

  @Delete('trips/:tripId/seat-pricing/:busSeatId')
  clearTripSeatPricing(
    @Param('tripId') tripId: string,
    @Param('busSeatId') busSeatId: string,
    @Query('fromSequence') fromSequence: string,
    @Query('toSequence') toSequence: string,
  ) {
    return this.pricing.clearTripSeatOverride(
      tripId,
      busSeatId,
      parseInt(fromSequence, 10),
      parseInt(toSequence, 10),
    );
  }

  @Get('routes/:routeId/detail')
  routeDetail(@Param('routeId') routeId: string) {
    return this.routesService.getRouteById(routeId);
  }

  @Get('schedules')
  listSchedules() {
    return this.schedulesService.listSchedules();
  }

  @Post('schedules')
  createSchedule(@Body() dto: CreateScheduleDto) {
    return this.schedulesService.createSchedule(dto);
  }

  @Patch('schedules/:id/deactivate')
  deactivateSchedule(@Param('id') id: string) {
    return this.schedulesService.deactivateSchedule(id);
  }

  @Patch('schedules/:id/activate')
  activateSchedule(@Param('id') id: string) {
    return this.schedulesService.activateSchedule(id);
  }

  @Patch('schedules/:id/assign-bus')
  reassignScheduleBus(@Param('id') id: string, @Body() dto: ReassignScheduleBusDto) {
    return this.schedulesService.reassignScheduleBus(id, dto.busId);
  }

  @Get('coupons')
  listCoupons() {
    return this.coupons.listAll();
  }

  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Delete('coupons/:id')
  deleteCoupon(@Param('id') id: string) {
    return this.coupons.remove(id);
  }

  @Post('operations/seed-launch-route')
  seedLaunchRoute() {
    return this.adminService.seedLaunchRoute();
  }

  @Post('notifications/dispatch-reminders')
  dispatchReminders() {
    return this.notifications.dispatchTripReminders(24);
  }

  @Get('partner-channels')
  listPartnerChannels() {
    return this.partnerChannels.listChannels();
  }

  @Patch('partner-channels/:id')
  updatePartnerChannel(@Param('id') id: string, @Body() dto: UpdatePartnerChannelDto) {
    return this.partnerChannels.updateChannel(id, dto);
  }

  @Post('partner-channels/:id/rotate-key')
  rotatePartnerKey(@Param('id') id: string) {
    return this.partnerChannels.rotateApiKey(id);
  }

  @Post('partner-channels/:id/test-webhook')
  testPartnerWebhook(@Param('id') id: string) {
    return this.partnerWebhooks.sendTestWebhook(id);
  }
}
