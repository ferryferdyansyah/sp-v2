import React, { useState, useEffect } from 'react'
import { TbMapShare } from 'react-icons/tb';
import logoWikrana from '../assets/logo4.png'

const Header = () => {
    return (
        <div className="bg-[#143079] w-full h-[68px] px-[64px] flex-shrink-0">
            <div className="flex items-center justify-between h-full">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                        <TbMapShare className="text-blue-900 text-xl" />
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-lg leading-none">SerahPeta</h1>
                        <p className="text-white text-xs leading-none mt-2">for ATR/BPN</p>
                    </div>
                </div>
                <div className="text-white text-right">
                    <img src={logoWikrana} alt="Wikrana Logo" className="h-6 w-auto object-contain" />
                </div>
            </div>
        </div>
    );
};

export default Header;