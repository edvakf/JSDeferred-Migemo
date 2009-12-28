#!/usr/bin/ruby -Ku
# -*- coding: utf-8 -*-

require 'open-uri'
require 'nkf'

# Some SKK dictionaries are distributed at
# http://openlab.jp/skk/wiki/wiki.cgi?page=SKK%BC%AD%BD%F1
dict_type = 'ML' # L, ML, M, S, etc
dict_url = "http://openlab.jp/skk/skk/dic/SKK-JISYO.#{dict_type}"

dict = {}

open(dict_url) do |f|
  okuri = true
  while line = f.gets
    line = NKF.nkf('-E -w', line)
    if line =~ /^;;\s*okuri-ari entries\.?/
      okuri = true
    elsif line =~ /^;;\s*okuri-nasi entries\.?/
      okuri = false
    elsif line !~ /^;;/ && line =~ /^(\S+)\s+(\/.*\/)/ 
      # line = "しゅん /春/瞬/駿/舜/竣/峻/俊/旬/" 
      #   => $1 = "しゅん", $2 = "春/瞬/駿/舜/竣/峻/俊/旬"
      yomi = $1
      words = $2.split(/(?:;.*?)?\//) # あいべつりく /愛別離苦;愛する者との死別の苦しみ/
      words.delete_if{|w| w.empty?}
      yomi = yomi[0..-2] if okuri
      yomi = yomi.sub(/>/, '')
      if dict.has_key?(yomi)
        dict[yomi] = dict[yomi] | words
      else
        dict[yomi] = words
      end
    end
  end
end

lisence_comment =<<EOF
# Migemo dictionary
# Copyright (c) 2009 JSDeferred-Migemo Developer
#
# This dictionary was derived from the SKK dictionary.
# <#{dict_url}>
#
# This dictionary is free software: you can redistribute it and/or 
# modify it under the terms of the GNU General Public License (GNU GPL)
# as published by the Free Software Foundation, either version 2, or
# (at your option) any later version.
#
# This dictionary is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# General Public License for more details.
EOF

file_ja = './migemo-dict-ja'
file_roman = './migemo-dict-ja-alphabet'
file_symbol = './migemo-dict-ja-symbol'

f1 = open(file_ja, 'w')
f2 = open(file_roman, 'w')
f3 = open(file_symbol, 'w')

f1.print(lisence_comment)
f2.print(lisence_comment)
f3.print(lisence_comment)

symbols = %w/~ ` ! @ # $ % ^ & * ( ) _ - + = { } [ ] \ | ; : ' " < > , . \//

dict.keys.sort.each do |yomi|
  if symbols.include?(yomi)
    f = f3
  elsif yomi =~ /^[ぁ-ゖー]+$/
    f = f1
  else
    f = f2
  end
  f.puts("#{yomi}\t#{dict[yomi].join("\t")}")
end

f1.close
f2.close
f3.close

