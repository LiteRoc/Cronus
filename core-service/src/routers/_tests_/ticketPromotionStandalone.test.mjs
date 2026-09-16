import { createRequire } from 'node:module';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createIsolatedMongoHarness } from '../../test/mongoMemoryHarness.mjs';
const requireCore=createRequire(new URL('../../../package.json',import.meta.url));
const mongoose=requireCore('mongoose');
let harness,app,Facility,Asset,Ticket,WO;
beforeAll(async()=>{
 process.env.JWT_SECRET='synthetic-standalone-promotion';process.env.JWT_ISS='cronus.api';process.env.JWT_AUD='cronus.app';
 harness=await createIsolatedMongoHarness(mongoose);
 [Facility,Asset,Ticket,WO]=['Facility','Asset','Tickets','WorkOrder'].map(n=>requireCore(`./src/models/${n}.js`));
 app=express();app.use(express.json());app.use('/workorders',requireCore('./src/routers/workOrderRouter.js'));
});
afterAll(async()=>{if(harness)await harness.stop();});
test('transaction-unavailable standalone MongoDB fails closed without any promotion writes',async()=>{
 const a=new mongoose.Types.ObjectId(),actor=new mongoose.Types.ObjectId();
 await Facility.collection.insertOne({_id:a,name:'Synthetic'});
 const asset=await Asset.create({facilityId:a,ctrlNumber:'SYNTHETIC',manufacturer:'Synthetic',model:'Synthetic'});
 const ticket=await Ticket.create({facilityId:a,assetId:asset._id,type:'service',status:'Approved',subject:'Synthetic',requestedBy:actor});
 const token=jwt.sign({sub:String(actor),role:'technician',facilityId:String(a),facilities:[String(a)]},process.env.JWT_SECRET,{issuer:'cronus.api',audience:'cronus.app',expiresIn:'10m'});
 const r=await request(app).post(`/workorders/from-ticket/${ticket._id}`).set({Authorization:`Bearer ${token}`,'x-facility-id':String(a)}).send({}).expect(503);
 expect(r.body).toEqual({error:'Ticket promotion unavailable'});expect(await WO.countDocuments()).toBe(0);
 const after=await Ticket.findById(ticket._id);expect(after.status).toBe('Approved');expect(after.workOrderId).toBeNull();
});
